/**
 * Drop-in replacement for config/redis.js, backed by an in-process Map --
 * no Redis/Memurai server needed (there is no such server on a phone).
 *
 * Implements only the subset of the ioredis API actually called anywhere in
 * this codebase (verified via `grep -rohE "\bredis\.[a-zA-Z]+\(" --exclude-dir=node_modules`
 * against every file that imports config/redis.js, directly or via a
 * `redis` parameter threaded through router configure() calls): get, set
 * (with EX/PX/NX/XX flags in any order), setex, del, expire, pexpire, ttl,
 * pttl, incr, incrby, decr, exists, mget, sadd, scard, spop, eval (only the
 * one compare-and-delete Lua script used by utils/redisLock.js is actually
 * interpreted -- see below), call, multi()/exec(), quit, on/once/connect
 * (no-op event-emitter stubs -- a Map is always "connected").
 *
 * Single-process on a phone: no distributed-lock semantics needed, so NX
 * locks degenerate to simple local mutual exclusion, which is exactly what
 * they're used for here (see server.js comments re: cluster workers).
 */

class MemoryRedis {
  constructor() {
    this.store = new Map(); // key -> { value: string, expiresAt: number|null }
    this._sweepTimer = setInterval(() => this._sweep(), 60_000);
    if (this._sweepTimer.unref) this._sweepTimer.unref();
  }

  _sweep() {
    const now = Date.now();
    for (const [k, v] of this.store) {
      if (v.expiresAt && v.expiresAt <= now) this.store.delete(k);
    }
  }

  _get(key) {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  // --- event-emitter-ish stubs (config/redis.js normally does redis.on('connect'/'error', ...)) ---
  on() { return this; }
  once() { return this; }
  emit() { return false; }
  async connect() { /* no-op: always "connected" */ }

  async get(key) {
    const e = this._get(key);
    return e ? e.value : null;
  }

  async set(key, value, ...flags) {
    let ttlMs = null;
    let nx = false;
    let xx = false;
    for (let i = 0; i < flags.length; i++) {
      const f = String(flags[i]).toUpperCase();
      if (f === 'EX') ttlMs = Number(flags[++i]) * 1000;
      else if (f === 'PX') ttlMs = Number(flags[++i]);
      else if (f === 'NX') nx = true;
      else if (f === 'XX') xx = true;
    }
    const exists = this._get(key) !== undefined;
    if (nx && exists) return null;
    if (xx && !exists) return null;
    this.store.set(key, {
      value: String(value),
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
    return 'OK';
  }

  async setex(key, seconds, value) {
    return this.set(key, value, 'EX', seconds);
  }

  async del(...keys) {
    keys = keys.flat();
    let n = 0;
    for (const k of keys) if (this.store.delete(k)) n++;
    return n;
  }

  async expire(key, seconds) {
    const e = this._get(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async pexpire(key, ms) {
    const e = this._get(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + ms;
    return 1;
  }

  async ttl(key) {
    const e = this._get(key);
    if (!e) return -2;
    if (!e.expiresAt) return -1;
    return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000));
  }

  async pttl(key) {
    const e = this._get(key);
    if (!e) return -2;
    if (!e.expiresAt) return -1;
    return Math.max(0, e.expiresAt - Date.now());
  }

  async exists(...keys) {
    keys = keys.flat();
    let n = 0;
    for (const k of keys) if (this._get(k) !== undefined) n++;
    return n;
  }

  async incrby(key, amount) {
    const e = this._get(key);
    const cur = e ? Number(e.value) || 0 : 0;
    const next = cur + Number(amount);
    this.store.set(key, { value: String(next), expiresAt: e ? e.expiresAt : null });
    return next;
  }
  async incr(key) { return this.incrby(key, 1); }
  async decr(key) { return this.incrby(key, -1); }

  async mget(...keys) {
    keys = keys.flat();
    return keys.map((k) => {
      const e = this._get(k);
      return e ? e.value : null;
    });
  }

  async sadd(key, ...members) {
    members = members.flat().map(String);
    const e = this._get(key);
    const set = new Set(e ? JSON.parse(e.value) : []);
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) { set.add(m); added++; }
    }
    this.store.set(key, { value: JSON.stringify([...set]), expiresAt: e ? e.expiresAt : null });
    return added;
  }

  async scard(key) {
    const e = this._get(key);
    return e ? JSON.parse(e.value).length : 0;
  }

  async spop(key, count) {
    const e = this._get(key);
    if (!e) return count === undefined ? null : [];
    const arr = JSON.parse(e.value);
    const n = count === undefined ? 1 : Number(count);
    const popped = arr.splice(0, n);
    this.store.set(key, { value: JSON.stringify(arr), expiresAt: e.expiresAt });
    return count === undefined ? (popped.length ? popped[0] : null) : popped;
  }

  // Only one Lua script is actually used anywhere in this codebase (see
  // utils/redisLock.js): a compare-and-delete for safe lock release. It's
  // pattern-matched and interpreted directly rather than implementing a
  // real Lua VM.
  async eval(script, numKeys, ...rest) {
    const keys = rest.slice(0, numKeys);
    const argv = rest.slice(numKeys);
    if (/redis\.call\(\s*["']get["']\s*,\s*KEYS\[1\]\s*\)\s*==\s*ARGV\[1\]/.test(script)) {
      const [key] = keys;
      const [expected] = argv;
      const e = this._get(key);
      if (e && e.value === expected) {
        this.store.delete(key);
        return 1;
      }
      return 0;
    }
    console.warn('[redisMemory] Unrecognized EVAL script (no-op):', script.slice(0, 120));
    return 0;
  }

  async call(command, ...args) {
    const fn = this[String(command).toLowerCase()];
    if (typeof fn === 'function') return fn.apply(this, args);
    throw new Error(`[redisMemory] Unsupported redis.call command: ${command}`);
  }

  multi() {
    const ops = [];
    const self = this;
    const chain = {
      get(key) { ops.push(['get', key]); return chain; },
      pttl(key) { ops.push(['pttl', key]); return chain; },
      ttl(key) { ops.push(['ttl', key]); return chain; },
      incr(key) { ops.push(['incr', key]); return chain; },
      incrby(key, n) { ops.push(['incrby', key, n]); return chain; },
      decr(key) { ops.push(['decr', key]); return chain; },
      pexpire(key, ms) { ops.push(['pexpire', key, ms]); return chain; },
      expire(key, s) { ops.push(['expire', key, s]); return chain; },
      del(key) { ops.push(['del', key]); return chain; },
      set(key, ...a) { ops.push(['set', key, ...a]); return chain; },
      async exec() {
        const results = [];
        for (const [cmd, ...args] of ops) {
          try {
            results.push([null, await self[cmd](...args)]);
          } catch (err) {
            results.push([err, null]);
          }
        }
        return results;
      },
    };
    return chain;
  }

  async duplicate() { return this; }
  async quit() { return 'OK'; }
  async disconnect() { /* no-op */ }
}

const redis = new MemoryRedis();
console.log('[Redis] Backend en mémoire (Map) actif — mode mobile/local, pas de serveur Redis requis');

// Wrapper autour de Redis pour garder l'interface memoryCache (get/set avec JSON auto)
// -- identical shape to config/redis.js's memoryCache
const memoryCache = {
  async get(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : undefined;
    } catch {
      return undefined;
    }
  },
  async set(key, value, ttl = 300) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch {
      /* ignore */
    }
  },
};

module.exports = { redis, memoryCache, MemoryRedis };
