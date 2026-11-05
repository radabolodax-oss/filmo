package com.tonsite.pcprowlermobile.dns;

import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.util.Log;

import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import javax.net.SocketFactory;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/**
 * Tunnel VPN local qui intercepte EXCLUSIVEMENT les requêtes DNS pour les résoudre
 * en DNS-over-HTTPS (DoH) via Cloudflare (1.1.1.1 / 1.0.0.1).
 *
 * Zéro trafic vidéo ne transite par un serveur externe : 100% de la bande passante
 * et de la batterie sont préservées, tout en contournant les blocages menteurs DNS
 * des opérateurs français (Orange, SFR, Free, Bouygues).
 */
public class DnsVpnService extends VpnService {

    private static final String TAG = "DawgerDns";
    private static final String VPN_ADDRESS = "10.215.173.1";
    private static final String VIRTUAL_DNS = "10.215.173.2";
    private static final String DOH_URL = "https://1.1.1.1/dns-query";
    private static final MediaType DNS_MESSAGE = MediaType.parse("application/dns-message");
    private static final int UDP_TIMEOUT_MS = 3000;
    private static final int WORKER_COUNT = 6;

    public static final String ACTION_STOP = "com.tonsite.pcprowlermobile.dns.STOP";
    public static volatile boolean isActive = false;

    private ParcelFileDescriptor vpnInterface = null;
    private volatile boolean isRunning = false;
    private Thread readerThread = null;
    private ExecutorService workers = null;
    private OkHttpClient httpClient = null;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopVpn();
            return START_NOT_STICKY;
        }
        startVpn();
        return START_STICKY;
    }

    private synchronized void startVpn() {
        if (isRunning) return;

        try {
            Builder builder = new Builder()
                    .setSession("Dawger DNS 1.1.1.1")
                    .addAddress(VPN_ADDRESS, 32)
                    .addDnsServer(VIRTUAL_DNS)
                    .addRoute(VIRTUAL_DNS, 32)
                    .setMtu(1500)
                    .setBlocking(true);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setMetered(false);
            }

            vpnInterface = builder.establish();
            if (vpnInterface != null) {
                httpClient = buildHttpClient();
                workers = Executors.newFixedThreadPool(WORKER_COUNT);
                isRunning = true;
                isActive = true;
                startDnsForwarding();
                Log.i(TAG, "✅ Tunnel DNS 1.1.1.1 actif (contournement FAI activé)");
            } else {
                Log.w(TAG, "Établissement du tunnel VPN refusé par le système Android");
            }
        } catch (Exception e) {
            Log.e(TAG, "Erreur démarrage VPN DNS:", e);
            stopVpn();
        }
    }

    private OkHttpClient buildHttpClient() {
        return new OkHttpClient.Builder()
                .socketFactory(new ProtectedSocketFactory())
                .connectTimeout(UDP_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .readTimeout(UDP_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .writeTimeout(UDP_TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .retryOnConnectionFailure(true)
                .build();
    }

    private void startDnsForwarding() {
        readerThread = new Thread(() -> {
            byte[] packet = new byte[32767];
            try (FileInputStream in = new FileInputStream(vpnInterface.getFileDescriptor());
                 FileOutputStream out = new FileOutputStream(vpnInterface.getFileDescriptor())) {

                while (isRunning && !Thread.currentThread().isInterrupted()) {
                    int length = in.read(packet);
                    if (length <= 0) continue;

                    // Analyse des paquets IP / UDP
                    int version = (packet[0] >> 4) & 0x0F;
                    if (version != 4) continue; // IPv4 seulement

                    int ipHeaderLength = (packet[0] & 0x0F) * 4;
                    int protocol = packet[9] & 0xFF;
                    if (protocol != 17) continue; // UDP seulement

                    int udpHeaderLength = 8;
                    int dnsPayloadOffset = ipHeaderLength + udpHeaderLength;
                    int dnsPayloadLength = length - dnsPayloadOffset;
                    if (dnsPayloadLength <= 0) continue;

                    byte[] dnsQuery = new byte[dnsPayloadLength];
                    System.arraycopy(packet, dnsPayloadOffset, dnsQuery, 0, dnsPayloadLength);

                    byte[] packetCopy = new byte[length];
                    System.arraycopy(packet, 0, packetCopy, 0, length);

                    workers.execute(() -> {
                        byte[] responsePayload = resolveDoH(dnsQuery);
                        if (responsePayload == null) {
                            responsePayload = resolveUdp(dnsQuery, "1.1.1.1");
                        }
                        if (responsePayload != null) {
                            byte[] responsePacket = buildResponsePacket(packetCopy, ipHeaderLength, responsePayload);
                            if (responsePacket != null) {
                                synchronized (out) {
                                    try {
                                        out.write(responsePacket);
                                    } catch (IOException ignored) {}
                                }
                            }
                        }
                    });
                }
            } catch (Exception ignored) {
            } finally {
                stopVpn();
            }
        }, "DawgerDnsReader");
        readerThread.start();
    }

    private byte[] resolveDoH(byte[] dnsQuery) {
        if (httpClient == null) return null;
        try {
            Request request = new Request.Builder()
                    .url(DOH_URL)
                    .post(RequestBody.create(dnsQuery, DNS_MESSAGE))
                    .header("Accept", "application/dns-message")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful() && response.body() != null) {
                    return response.body().bytes();
                }
            }
        } catch (Exception ignored) {}
        return null;
    }

    private byte[] resolveUdp(byte[] query, String serverIp) {
        try (DatagramSocket socket = new DatagramSocket()) {
            protect(socket);
            socket.setSoTimeout(UDP_TIMEOUT_MS);
            InetAddress address = InetAddress.getByName(serverIp);
            DatagramPacket out = new DatagramPacket(query, query.length, address, 53);
            socket.send(out);

            byte[] buffer = new byte[2048];
            DatagramPacket in = new DatagramPacket(buffer, buffer.length);
            socket.receive(in);

            byte[] response = new byte[in.getLength()];
            System.arraycopy(buffer, 0, response, 0, in.getLength());
            return response;
        } catch (Exception ignored) {}
        return null;
    }

    private byte[] buildResponsePacket(byte[] originalPacket, int ipHeaderLength, byte[] dnsResponse) {
        try {
            int totalLength = ipHeaderLength + 8 + dnsResponse.length;
            if (totalLength > 0xFFFF) return null;
            byte[] response = new byte[totalLength];

            // Copie en-tête IP d'origine
            System.arraycopy(originalPacket, 0, response, 0, ipHeaderLength);
            // Inversion IPs source et destination
            System.arraycopy(originalPacket, 12, response, 16, 4);
            System.arraycopy(originalPacket, 16, response, 12, 4);

            response[2] = (byte) ((totalLength >> 8) & 0xFF);
            response[3] = (byte) (totalLength & 0xFF);

            // Inversion des ports UDP
            response[ipHeaderLength] = originalPacket[ipHeaderLength + 2];
            response[ipHeaderLength + 1] = originalPacket[ipHeaderLength + 3];
            response[ipHeaderLength + 2] = originalPacket[ipHeaderLength];
            response[ipHeaderLength + 3] = originalPacket[ipHeaderLength + 1];

            int udpLength = 8 + dnsResponse.length;
            response[ipHeaderLength + 4] = (byte) ((udpLength >> 8) & 0xFF);
            response[ipHeaderLength + 5] = (byte) (udpLength & 0xFF);
            response[ipHeaderLength + 6] = 0;
            response[ipHeaderLength + 7] = 0;

            System.arraycopy(dnsResponse, 0, response, ipHeaderLength + 8, dnsResponse.length);

            // Checksum IP
            response[10] = 0;
            response[11] = 0;
            int checksum = 0;
            for (int i = 0; i < ipHeaderLength; i += 2) {
                checksum += ((response[i] & 0xFF) << 8) | (response[i + 1] & 0xFF);
            }
            checksum = (checksum >> 16) + (checksum & 0xFFFF);
            checksum += (checksum >> 16);
            checksum = ~checksum & 0xFFFF;
            response[10] = (byte) ((checksum >> 8) & 0xFF);
            response[11] = (byte) (checksum & 0xFF);

            return response;
        } catch (Exception ignored) {
            return null;
        }
    }

    private synchronized void stopVpn() {
        if (!isRunning) return;
        isRunning = false;
        isActive = false;
        if (readerThread != null) {
            readerThread.interrupt();
            readerThread = null;
        }
        if (workers != null) {
            workers.shutdownNow();
            workers = null;
        }
        if (httpClient != null) {
            new Thread(() -> {
                try {
                    httpClient.dispatcher().executorService().shutdown();
                    httpClient.connectionPool().evictAll();
                } catch (Exception ignored) {}
            }).start();
            httpClient = null;
        }
        if (vpnInterface != null) {
            try { vpnInterface.close(); } catch (Exception ignored) {}
            vpnInterface = null;
        }
        stopSelf();
        Log.i(TAG, "Tunnel DNS arrêté");
    }

    @Override
    public void onDestroy() {
        stopVpn();
        super.onDestroy();
    }

    @Override
    public void onRevoke() {
        stopVpn();
        super.onRevoke();
    }

    private class ProtectedSocketFactory extends SocketFactory {
        @Override
        public Socket createSocket() throws IOException {
            Socket socket = new Socket();
            socket.setReuseAddress(true);
            protect(socket);
            return socket;
        }

        @Override
        public Socket createSocket(String host, int port) throws IOException {
            Socket s = createSocket();
            s.connect(new InetSocketAddress(host, port));
            return s;
        }

        @Override
        public Socket createSocket(String host, int port, InetAddress localHost, int localPort) throws IOException {
            Socket s = createSocket();
            s.bind(new InetSocketAddress(localHost, localPort));
            s.connect(new InetSocketAddress(host, port));
            return s;
        }

        @Override
        public Socket createSocket(InetAddress host, int port) throws IOException {
            Socket s = createSocket();
            s.connect(new InetSocketAddress(host, port));
            return s;
        }

        @Override
        public Socket createSocket(InetAddress address, int port, InetAddress localAddress, int localPort) throws IOException {
            Socket s = createSocket();
            s.bind(new InetSocketAddress(localAddress, localPort));
            s.connect(new InetSocketAddress(address, port));
            return s;
        }
    }
}
