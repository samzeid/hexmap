// In-memory/localStorage-backed stand-in for the Firebase compat SDK surface
// this app actually uses: ref/on/off/once/set/update/remove/push/limitToLast/
// transaction, plus auth.onAuthStateChanged/signInWithEmailAndPassword/
// signOut/currentUser. Loaded by the generated test-harness.html in place of
// the real Firebase CDN scripts, so tests never touch the real project.
//
// Cross-tab sync goes through localStorage (the shared "server" data) plus a
// BroadcastChannel (the "someone wrote, go re-read" notification — the
// native 'storage' event turned out to be unreliable for this in headless
// Chrome). An artificial per-ref delay (mockDelay ms, default 150) stands in
// for real Firebase round-trip latency, so races can be provoked
// deterministically by staggering actions instead of depending on real
// network jitter.
(() => {
  const DB_KEY = '__mockFirebaseDB__';
  const params = new URLSearchParams(location.search);
  const testUid  = params.get('testUid')  || 'anon';
  const testName = params.get('testName') || testUid;
  const delayMs  = parseInt(params.get('mockDelay') || '150', 10);

  if (params.get('reset') === '1') localStorage.removeItem(DB_KEY);

  function readDB() {
    try { return JSON.parse(localStorage.getItem(DB_KEY) || '{}'); } catch { return {}; }
  }
  function writeDB(tree) { localStorage.setItem(DB_KEY, JSON.stringify(tree)); }

  function parts(path) { return path.split('/').filter(Boolean); }

  function getAtPath(tree, path) {
    let node = tree;
    for (const p of parts(path)) { if (node == null) return null; node = node[p]; }
    return node === undefined ? null : node;
  }

  function setAtPath(tree, path, value) {
    const ps = parts(path);
    if (!ps.length) {
      Object.keys(tree).forEach(k => delete tree[k]);
      if (value && typeof value === 'object') Object.assign(tree, value);
      return;
    }
    let node = tree;
    for (let i = 0; i < ps.length - 1; i++) {
      const p = ps[i];
      if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
      node = node[p];
    }
    const last = ps[ps.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = value;
  }

  function updateAtPath(tree, path, updates) {
    const ps = parts(path);
    let node = tree;
    for (const p of ps) {
      if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
      node = node[p];
    }
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) delete node[k];
      else node[k] = v;
    }
  }

  // path -> Set<callback>, for 'value' listeners
  const listeners = {};

  function makeSnapshot(val, key) {
    return {
      key: key !== undefined ? key : null,
      val: () => val,
      exists: () => val !== null && val !== undefined,
      forEach: fn => {
        if (val && typeof val === 'object') {
          Object.keys(val).sort().forEach(k => fn(makeSnapshot(val[k], k)));
        }
      },
    };
  }

  function notifyPath(path) {
    // Bubble to every registered ancestor (and the path itself), matching
    // Firebase: a 'value' listener on a parent fires when a descendant
    // changes. Each listener's callback is isolated in its own try/catch —
    // real Firebase doesn't let one listener throwing stop others in the
    // same tree from being notified, and this mock must not either (an
    // unrelated crash elsewhere in the app must not silently swallow a
    // notification this app's own listeners are waiting on).
    const ps = parts(path);
    const tree = readDB();
    for (let i = ps.length; i >= 0; i--) {
      const p = '/' + ps.slice(0, i).join('/');
      const set = listeners[p];
      if (set) set.forEach(cb => {
        try { cb(makeSnapshot(getAtPath(tree, p))); }
        catch (e) { console.error('[mock-firebase] listener error on', p, e); }
      });
    }
  }

  function notifyAllRegistered() { Object.keys(listeners).forEach(p => notifyPath(p)); }

  const bc = new BroadcastChannel('__mockFirebaseDB__bc__');
  bc.onmessage = () => notifyAllRegistered();

  function commit(mutate) {
    return new Promise(resolve => {
      setTimeout(() => {
        const tree = readDB();
        mutate(tree);
        writeDB(tree);
        resolve();
      }, delayMs);
    });
  }

  function makeRef(rawPath) {
    const path = '/' + parts(rawPath).join('/');
    const ref = {
      get key() { return parts(path).pop() || null; },
      child(p) { return makeRef(path + '/' + p); },
      limitToLast() { return ref; }, // accepted, not enforced — fine for these tests
      on(event, cb) {
        if (event !== 'value') return;
        (listeners[path] = listeners[path] || new Set()).add(cb);
        cb(makeSnapshot(getAtPath(readDB(), path)));
      },
      off(event) {
        if (event === 'value' || event === undefined) delete listeners[path];
      },
      once(event, cb) {
        const p = new Promise(resolve => {
          setTimeout(() => resolve(makeSnapshot(getAtPath(readDB(), path))), delayMs);
        });
        if (cb) p.then(cb);
        return p;
      },
      set(value) {
        return commit(tree => setAtPath(tree, path, value)).then(() => { notifyPath(path); bc.postMessage('changed'); });
      },
      update(updates) {
        return commit(tree => updateAtPath(tree, path, updates)).then(() => { notifyPath(path); bc.postMessage('changed'); });
      },
      remove() {
        return commit(tree => setAtPath(tree, path, null)).then(() => { notifyPath(path); bc.postMessage('changed'); });
      },
      push() {
        const id = '-test' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        return makeRef(path + '/' + id);
      },
      // Simplified relative to real Firebase: reads the current value and
      // writes the transformed result within one delayed (artificial-
      // latency) callback, rather than a true atomic compare-and-swap with
      // retry. Sufficient for testing merge *logic*: in this single-
      // threaded mock, each transaction's read happens at its own
      // callback-fire time, so a transaction that fires after another's has
      // already committed correctly sees that committed value — which is
      // exactly the ordering the app's merge path depends on. It does not
      // model true concurrent-retry semantics (see tests/README.md).
      transaction(updateFn, onComplete) {
        setTimeout(() => {
          const tree = readDB();
          const current = getAtPath(tree, path);
          let next;
          try { next = updateFn(current); } catch (e) { next = undefined; }
          if (next === undefined) {
            if (onComplete) onComplete(null, false, makeSnapshot(current));
            return;
          }
          setAtPath(tree, path, next);
          writeDB(tree);
          notifyPath(path);
          bc.postMessage('changed');
          if (onComplete) onComplete(null, true, makeSnapshot(next));
        }, delayMs);
      },
    };
    return ref;
  }

  const database = { ref: makeRef };

  // ---- Auth ----
  let currentUser = null;
  const authListeners = [];
  const fakeUser = { uid: testUid, email: testName + '@test.local', displayName: testName };
  const auth = {
    onAuthStateChanged(cb) {
      authListeners.push(cb);
      setTimeout(() => cb(currentUser), 0);
    },
    signInWithEmailAndPassword() {
      currentUser = fakeUser;
      setTimeout(() => authListeners.forEach(cb => cb(currentUser)), 0);
      return Promise.resolve({ user: currentUser });
    },
    signOut() {
      currentUser = null;
      authListeners.forEach(cb => cb(null));
      return Promise.resolve();
    },
    get currentUser() { return currentUser; },
  };

  if (params.get('noAutoLogin') !== '1') {
    currentUser = fakeUser;
    setTimeout(() => authListeners.forEach(cb => cb(currentUser)), 0);
  }

  const databaseFn = () => database;
  databaseFn.ServerValue = { TIMESTAMP: Date.now() }; // static approximation; fine for these tests

  window.firebase = {
    initializeApp() { return { database: () => database }; },
    auth: () => auth,
    database: databaseFn,
  };

  window.__mockFirebase = { readDB, writeDB, testUid, testName };
})();
