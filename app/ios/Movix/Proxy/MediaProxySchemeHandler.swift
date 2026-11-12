import Foundation
import WebKit

/// Sert au moteur web les médias qui exigent des en-têtes, via un schéma
/// d'URL personnalisé.
///
/// Pourquoi ce détour : certains hébergeurs (Veev, et tout ce qui sert un MP4
/// progressif) livrent une URL qui finit sur un élément `video`. La requête
/// qu'émet cet élément n'est interceptable ni par `fetch` ni par XHR — elle
/// part donc sans Referer ni Origin, et le CDN la refuse. Sur Android on la
/// fait passer par la boucle locale, mais WebKit refuse `http://127.0.0.1`
/// depuis une page https (contenu mixte, bugs WebKit 171934 / 218627). Un
/// schéma personnalisé, lui, n'est pas soumis au contenu mixte : WebKit route
/// ces requêtes vers ce handler, qui peut les servir depuis le natif.
///
/// Le handler ne refait pas le travail du proxy : il relaie vers le serveur de
/// boucle locale, qui authentifie déjà le jeton du chemin, valide la cible
/// (SSRF), pose les en-têtes, suit les redirections et sait répondre aux
/// plages d'octets. On ne fait que traduire le schéma et rendre le flux.
///
/// `movix-media://127.0.0.1:<port>/p/…` -> `http://127.0.0.1:<port>/p/…`
@objc(MovixMediaSchemeHandler)
final class MediaProxySchemeHandler: NSObject, WKURLSchemeHandler {
  static let scheme = "movix-media"

  private let session: URLSession
  private let sessionDelegate = StreamingDelegate()

  override init() {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    // La boucle locale ne doit jamais sortir par un proxy système, ni être
    // retenue par une attente : c'est un socket sur l'appareil.
    configuration.connectionProxyDictionary = [:]
    configuration.waitsForConnectivity = false
    session = URLSession(
      configuration: configuration,
      delegate: sessionDelegate,
      delegateQueue: .main
    )
    super.init()
  }

  func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
    if let reqURL = urlSchemeTask.request.url,
       reqURL.host?.lowercased() == "appassets.androidplatform.net" {
      serveBundledWebAsset(for: reqURL, task: urlSchemeTask)
      return
    }

    guard let upstream = Self.loopbackURL(for: urlSchemeTask.request.url) else {
      urlSchemeTask.didFailWithError(URLError(.badURL))
      return
    }

    var request = URLRequest(url: upstream)
    request.httpMethod = urlSchemeTask.request.httpMethod ?? "GET"
    // Seule la plage demandée par l'élément média nous intéresse ici : le reste
    // de l'identité du client est posé par le proxy, qui rejoue celle ayant
    // obtenu le jeton. Relayer les en-têtes de la WebView l'écraserait.
    if let range = urlSchemeTask.request.value(forHTTPHeaderField: "Range") {
      request.setValue(range, forHTTPHeaderField: "Range")
    }

    let task = session.dataTask(with: request)
    sessionDelegate.attach(task: task, to: urlSchemeTask)
    task.resume()
  }

  private func serveBundledWebAsset(for url: URL, task: WKURLSchemeTask) {
    guard let distRoot = Bundle.main.resourceURL?.appendingPathComponent("dist", isDirectory: true) else {
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }

    var rawPath = url.path
    while rawPath.hasPrefix("/") { rawPath.removeFirst() }
    if rawPath.isEmpty { rawPath = "index.html" }

    let resolvedRoot = distRoot.standardizedFileURL.path
    var candidate = distRoot.appendingPathComponent(rawPath).standardizedFileURL
    var isDir: ObjCBool = false

    if !FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDir) || isDir.boolValue {
      // Fallback SPA vers index.html pour React Router (/movies, /tv, /watch/...)
      let ext = (rawPath as NSString).pathExtension.lowercased()
      if ext.isEmpty || ext == "html" {
        candidate = distRoot.appendingPathComponent("index.html").standardizedFileURL
      } else {
        let notFound = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: [
          "Content-Type": "text/plain; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        ])!
        task.didReceive(notFound)
        task.didFinish()
        return
      }
    }

    guard candidate.path.hasPrefix(resolvedRoot),
          let data = try? Data(contentsOf: candidate) else {
      task.didFailWithError(URLError(.fileDoesNotExist))
      return
    }

    let mime = Self.mimeType(for: candidate.pathExtension.lowercased())
    let headers: [String: String] = [
      "Content-Type": mime,
      "Content-Length": "\(data.count)",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    ]
    if let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers) {
      task.didReceive(response)
    }
    task.didReceive(data)
    task.didFinish()
  }

  private static func mimeType(for ext: String) -> String {
    switch ext {
    case "html", "htm": return "text/html; charset=utf-8"
    case "js", "mjs": return "application/javascript; charset=utf-8"
    case "css": return "text/css; charset=utf-8"
    case "json", "map": return "application/json; charset=utf-8"
    case "svg": return "image/svg+xml"
    case "png": return "image/png"
    case "jpg", "jpeg": return "image/jpeg"
    case "webp": return "image/webp"
    case "gif": return "image/gif"
    case "ico": return "image/x-icon"
    case "woff2": return "font/woff2"
    case "woff": return "font/woff"
    case "ttf": return "font/ttf"
    case "mp4": return "video/mp4"
    case "webm": return "video/webm"
    default: return "application/octet-stream"
    }
  }

  func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
    sessionDelegate.cancel(urlSchemeTask)
  }

  /// Traduit l'URL du schéma personnalisé vers la boucle locale. Volontairement
  /// stricte : tout ce qui n'est pas exactement `127.0.0.1:<port>` avec un
  /// chemin et rien d'autre est refusé, plutôt que réparé.
  static func loopbackURL(for url: URL?) -> URL? {
    guard let url = url,
          var components = URLComponents(url: url, resolvingAgainstBaseURL: false),
          components.scheme?.lowercased() == scheme,
          components.host == "127.0.0.1",
          let port = components.port,
          port > 0, port <= 65_535,
          components.user == nil,
          components.password == nil,
          components.query == nil,
          components.fragment == nil,
          !components.percentEncodedPath.isEmpty,
          components.percentEncodedPath.hasPrefix("/"),
          !components.percentEncodedPath.contains("//") else {
      return nil
    }
    components.scheme = "http"
    return components.url
  }
}

/// Relaie la réponse au fil de l'eau : un MP4 se lit en plages, le charger en
/// entier avant de répondre le rendrait injouable.
///
/// WebKit interdit de toucher une `WKURLSchemeTask` après son `stop`, sous
/// peine de crash — d'où la table des tâches vivantes, tenue sur la file
/// principale, seule à laquelle la session délivre.
private final class StreamingDelegate: NSObject, URLSessionDataDelegate {
  private var tasks: [Int: WKURLSchemeTask] = [:]

  func attach(task: URLSessionTask, to schemeTask: WKURLSchemeTask) {
    tasks[task.taskIdentifier] = schemeTask
  }

  func cancel(_ schemeTask: WKURLSchemeTask) {
    guard let entry = tasks.first(where: { $0.value === schemeTask }) else { return }
    tasks.removeValue(forKey: entry.key)
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive response: URLResponse,
    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void
  ) {
    guard let schemeTask = tasks[dataTask.taskIdentifier] else {
      completionHandler(.cancel)
      return
    }
    schemeTask.didReceive(response)
    completionHandler(.allow)
  }

  func urlSession(
    _ session: URLSession,
    dataTask: URLSessionDataTask,
    didReceive data: Data
  ) {
    tasks[dataTask.taskIdentifier]?.didReceive(data)
  }

  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?
  ) {
    guard let schemeTask = tasks.removeValue(forKey: task.taskIdentifier) else { return }
    if let error = error {
      schemeTask.didFailWithError(error)
    } else {
      schemeTask.didFinish()
    }
  }
}
