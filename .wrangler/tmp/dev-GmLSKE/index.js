var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// node_modules/unenv/dist/runtime/_internal/utils.mjs
// @__NO_SIDE_EFFECTS__
function createNotImplementedError(name) {
  return new Error(`[unenv] ${name} is not implemented yet!`);
}
__name(createNotImplementedError, "createNotImplementedError");
// @__NO_SIDE_EFFECTS__
function notImplemented(name) {
  const fn = /* @__PURE__ */ __name(() => {
    throw /* @__PURE__ */ createNotImplementedError(name);
  }, "fn");
  return Object.assign(fn, { __unenv__: true });
}
__name(notImplemented, "notImplemented");
// @__NO_SIDE_EFFECTS__
function notImplementedClass(name) {
  return class {
    __unenv__ = true;
    constructor() {
      throw new Error(`[unenv] ${name} is not implemented yet!`);
    }
  };
}
__name(notImplementedClass, "notImplementedClass");

// node_modules/unenv/dist/runtime/node/internal/perf_hooks/performance.mjs
var _timeOrigin = globalThis.performance?.timeOrigin ?? Date.now();
var _performanceNow = globalThis.performance?.now ? globalThis.performance.now.bind(globalThis.performance) : () => Date.now() - _timeOrigin;
var nodeTiming = {
  name: "node",
  entryType: "node",
  startTime: 0,
  duration: 0,
  nodeStart: 0,
  v8Start: 0,
  bootstrapComplete: 0,
  environment: 0,
  loopStart: 0,
  loopExit: 0,
  idleTime: 0,
  uvMetricsInfo: {
    loopCount: 0,
    events: 0,
    eventsWaiting: 0
  },
  detail: void 0,
  toJSON() {
    return this;
  }
};
var PerformanceEntry = class {
  static {
    __name(this, "PerformanceEntry");
  }
  __unenv__ = true;
  detail;
  entryType = "event";
  name;
  startTime;
  constructor(name, options) {
    this.name = name;
    this.startTime = options?.startTime || _performanceNow();
    this.detail = options?.detail;
  }
  get duration() {
    return _performanceNow() - this.startTime;
  }
  toJSON() {
    return {
      name: this.name,
      entryType: this.entryType,
      startTime: this.startTime,
      duration: this.duration,
      detail: this.detail
    };
  }
};
var PerformanceMark = class PerformanceMark2 extends PerformanceEntry {
  static {
    __name(this, "PerformanceMark");
  }
  entryType = "mark";
  constructor() {
    super(...arguments);
  }
  get duration() {
    return 0;
  }
};
var PerformanceMeasure = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceMeasure");
  }
  entryType = "measure";
};
var PerformanceResourceTiming = class extends PerformanceEntry {
  static {
    __name(this, "PerformanceResourceTiming");
  }
  entryType = "resource";
  serverTiming = [];
  connectEnd = 0;
  connectStart = 0;
  decodedBodySize = 0;
  domainLookupEnd = 0;
  domainLookupStart = 0;
  encodedBodySize = 0;
  fetchStart = 0;
  initiatorType = "";
  name = "";
  nextHopProtocol = "";
  redirectEnd = 0;
  redirectStart = 0;
  requestStart = 0;
  responseEnd = 0;
  responseStart = 0;
  secureConnectionStart = 0;
  startTime = 0;
  transferSize = 0;
  workerStart = 0;
  responseStatus = 0;
};
var PerformanceObserverEntryList = class {
  static {
    __name(this, "PerformanceObserverEntryList");
  }
  __unenv__ = true;
  getEntries() {
    return [];
  }
  getEntriesByName(_name, _type) {
    return [];
  }
  getEntriesByType(type) {
    return [];
  }
};
var Performance = class {
  static {
    __name(this, "Performance");
  }
  __unenv__ = true;
  timeOrigin = _timeOrigin;
  eventCounts = /* @__PURE__ */ new Map();
  _entries = [];
  _resourceTimingBufferSize = 0;
  navigation = void 0;
  timing = void 0;
  timerify(_fn, _options) {
    throw createNotImplementedError("Performance.timerify");
  }
  get nodeTiming() {
    return nodeTiming;
  }
  eventLoopUtilization() {
    return {};
  }
  markResourceTiming() {
    return new PerformanceResourceTiming("");
  }
  onresourcetimingbufferfull = null;
  now() {
    if (this.timeOrigin === _timeOrigin) {
      return _performanceNow();
    }
    return Date.now() - this.timeOrigin;
  }
  clearMarks(markName) {
    this._entries = markName ? this._entries.filter((e) => e.name !== markName) : this._entries.filter((e) => e.entryType !== "mark");
  }
  clearMeasures(measureName) {
    this._entries = measureName ? this._entries.filter((e) => e.name !== measureName) : this._entries.filter((e) => e.entryType !== "measure");
  }
  clearResourceTimings() {
    this._entries = this._entries.filter((e) => e.entryType !== "resource" || e.entryType !== "navigation");
  }
  getEntries() {
    return this._entries;
  }
  getEntriesByName(name, type) {
    return this._entries.filter((e) => e.name === name && (!type || e.entryType === type));
  }
  getEntriesByType(type) {
    return this._entries.filter((e) => e.entryType === type);
  }
  mark(name, options) {
    const entry = new PerformanceMark(name, options);
    this._entries.push(entry);
    return entry;
  }
  measure(measureName, startOrMeasureOptions, endMark) {
    let start;
    let end;
    if (typeof startOrMeasureOptions === "string") {
      start = this.getEntriesByName(startOrMeasureOptions, "mark")[0]?.startTime;
      end = this.getEntriesByName(endMark, "mark")[0]?.startTime;
    } else {
      start = Number.parseFloat(startOrMeasureOptions?.start) || this.now();
      end = Number.parseFloat(startOrMeasureOptions?.end) || this.now();
    }
    const entry = new PerformanceMeasure(measureName, {
      startTime: start,
      detail: {
        start,
        end
      }
    });
    this._entries.push(entry);
    return entry;
  }
  setResourceTimingBufferSize(maxSize) {
    this._resourceTimingBufferSize = maxSize;
  }
  addEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.addEventListener");
  }
  removeEventListener(type, listener, options) {
    throw createNotImplementedError("Performance.removeEventListener");
  }
  dispatchEvent(event) {
    throw createNotImplementedError("Performance.dispatchEvent");
  }
  toJSON() {
    return this;
  }
};
var PerformanceObserver = class {
  static {
    __name(this, "PerformanceObserver");
  }
  __unenv__ = true;
  static supportedEntryTypes = [];
  _callback = null;
  constructor(callback) {
    this._callback = callback;
  }
  takeRecords() {
    return [];
  }
  disconnect() {
    throw createNotImplementedError("PerformanceObserver.disconnect");
  }
  observe(options) {
    throw createNotImplementedError("PerformanceObserver.observe");
  }
  bind(fn) {
    return fn;
  }
  runInAsyncScope(fn, thisArg, ...args) {
    return fn.call(thisArg, ...args);
  }
  asyncId() {
    return 0;
  }
  triggerAsyncId() {
    return 0;
  }
  emitDestroy() {
    return this;
  }
};
var performance = globalThis.performance && "addEventListener" in globalThis.performance ? globalThis.performance : new Performance();

// node_modules/@cloudflare/unenv-preset/dist/runtime/polyfill/performance.mjs
globalThis.performance = performance;
globalThis.Performance = Performance;
globalThis.PerformanceEntry = PerformanceEntry;
globalThis.PerformanceMark = PerformanceMark;
globalThis.PerformanceMeasure = PerformanceMeasure;
globalThis.PerformanceObserver = PerformanceObserver;
globalThis.PerformanceObserverEntryList = PerformanceObserverEntryList;
globalThis.PerformanceResourceTiming = PerformanceResourceTiming;

// node_modules/unenv/dist/runtime/node/console.mjs
import { Writable } from "node:stream";

// node_modules/unenv/dist/runtime/mock/noop.mjs
var noop_default = Object.assign(() => {
}, { __unenv__: true });

// node_modules/unenv/dist/runtime/node/console.mjs
var _console = globalThis.console;
var _ignoreErrors = true;
var _stderr = new Writable();
var _stdout = new Writable();
var log = _console?.log ?? noop_default;
var info = _console?.info ?? log;
var trace = _console?.trace ?? info;
var debug = _console?.debug ?? log;
var table = _console?.table ?? log;
var error = _console?.error ?? log;
var warn = _console?.warn ?? error;
var createTask = _console?.createTask ?? /* @__PURE__ */ notImplemented("console.createTask");
var clear = _console?.clear ?? noop_default;
var count = _console?.count ?? noop_default;
var countReset = _console?.countReset ?? noop_default;
var dir = _console?.dir ?? noop_default;
var dirxml = _console?.dirxml ?? noop_default;
var group = _console?.group ?? noop_default;
var groupEnd = _console?.groupEnd ?? noop_default;
var groupCollapsed = _console?.groupCollapsed ?? noop_default;
var profile = _console?.profile ?? noop_default;
var profileEnd = _console?.profileEnd ?? noop_default;
var time = _console?.time ?? noop_default;
var timeEnd = _console?.timeEnd ?? noop_default;
var timeLog = _console?.timeLog ?? noop_default;
var timeStamp = _console?.timeStamp ?? noop_default;
var Console = _console?.Console ?? /* @__PURE__ */ notImplementedClass("console.Console");
var _times = /* @__PURE__ */ new Map();
var _stdoutErrorHandler = noop_default;
var _stderrErrorHandler = noop_default;

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/console.mjs
var workerdConsole = globalThis["console"];
var {
  assert,
  clear: clear2,
  // @ts-expect-error undocumented public API
  context,
  count: count2,
  countReset: countReset2,
  // @ts-expect-error undocumented public API
  createTask: createTask2,
  debug: debug2,
  dir: dir2,
  dirxml: dirxml2,
  error: error2,
  group: group2,
  groupCollapsed: groupCollapsed2,
  groupEnd: groupEnd2,
  info: info2,
  log: log2,
  profile: profile2,
  profileEnd: profileEnd2,
  table: table2,
  time: time2,
  timeEnd: timeEnd2,
  timeLog: timeLog2,
  timeStamp: timeStamp2,
  trace: trace2,
  warn: warn2
} = workerdConsole;
Object.assign(workerdConsole, {
  Console,
  _ignoreErrors,
  _stderr,
  _stderrErrorHandler,
  _stdout,
  _stdoutErrorHandler,
  _times
});
var console_default = workerdConsole;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-console
globalThis.console = console_default;

// node_modules/unenv/dist/runtime/node/internal/process/hrtime.mjs
var hrtime = /* @__PURE__ */ Object.assign(/* @__PURE__ */ __name(function hrtime2(startTime) {
  const now = Date.now();
  const seconds = Math.trunc(now / 1e3);
  const nanos = now % 1e3 * 1e6;
  if (startTime) {
    let diffSeconds = seconds - startTime[0];
    let diffNanos = nanos - startTime[0];
    if (diffNanos < 0) {
      diffSeconds = diffSeconds - 1;
      diffNanos = 1e9 + diffNanos;
    }
    return [diffSeconds, diffNanos];
  }
  return [seconds, nanos];
}, "hrtime"), { bigint: /* @__PURE__ */ __name(function bigint() {
  return BigInt(Date.now() * 1e6);
}, "bigint") });

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
import { EventEmitter } from "node:events";

// node_modules/unenv/dist/runtime/node/internal/tty/read-stream.mjs
var ReadStream = class {
  static {
    __name(this, "ReadStream");
  }
  fd;
  isRaw = false;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  setRawMode(mode) {
    this.isRaw = mode;
    return this;
  }
};

// node_modules/unenv/dist/runtime/node/internal/tty/write-stream.mjs
var WriteStream = class {
  static {
    __name(this, "WriteStream");
  }
  fd;
  columns = 80;
  rows = 24;
  isTTY = false;
  constructor(fd) {
    this.fd = fd;
  }
  clearLine(dir3, callback) {
    callback && callback();
    return false;
  }
  clearScreenDown(callback) {
    callback && callback();
    return false;
  }
  cursorTo(x, y, callback) {
    callback && typeof callback === "function" && callback();
    return false;
  }
  moveCursor(dx, dy, callback) {
    callback && callback();
    return false;
  }
  getColorDepth(env2) {
    return 1;
  }
  hasColors(count3, env2) {
    return false;
  }
  getWindowSize() {
    return [this.columns, this.rows];
  }
  write(str, encoding, cb) {
    if (str instanceof Uint8Array) {
      str = new TextDecoder().decode(str);
    }
    try {
      console.log(str);
    } catch {
    }
    cb && typeof cb === "function" && cb();
    return false;
  }
};

// node_modules/unenv/dist/runtime/node/internal/process/node-version.mjs
var NODE_VERSION = "22.14.0";

// node_modules/unenv/dist/runtime/node/internal/process/process.mjs
var Process = class _Process extends EventEmitter {
  static {
    __name(this, "Process");
  }
  env;
  hrtime;
  nextTick;
  constructor(impl) {
    super();
    this.env = impl.env;
    this.hrtime = impl.hrtime;
    this.nextTick = impl.nextTick;
    for (const prop of [...Object.getOwnPropertyNames(_Process.prototype), ...Object.getOwnPropertyNames(EventEmitter.prototype)]) {
      const value = this[prop];
      if (typeof value === "function") {
        this[prop] = value.bind(this);
      }
    }
  }
  // --- event emitter ---
  emitWarning(warning, type, code) {
    console.warn(`${code ? `[${code}] ` : ""}${type ? `${type}: ` : ""}${warning}`);
  }
  emit(...args) {
    return super.emit(...args);
  }
  listeners(eventName) {
    return super.listeners(eventName);
  }
  // --- stdio (lazy initializers) ---
  #stdin;
  #stdout;
  #stderr;
  get stdin() {
    return this.#stdin ??= new ReadStream(0);
  }
  get stdout() {
    return this.#stdout ??= new WriteStream(1);
  }
  get stderr() {
    return this.#stderr ??= new WriteStream(2);
  }
  // --- cwd ---
  #cwd = "/";
  chdir(cwd2) {
    this.#cwd = cwd2;
  }
  cwd() {
    return this.#cwd;
  }
  // --- dummy props and getters ---
  arch = "";
  platform = "";
  argv = [];
  argv0 = "";
  execArgv = [];
  execPath = "";
  title = "";
  pid = 200;
  ppid = 100;
  get version() {
    return `v${NODE_VERSION}`;
  }
  get versions() {
    return { node: NODE_VERSION };
  }
  get allowedNodeEnvironmentFlags() {
    return /* @__PURE__ */ new Set();
  }
  get sourceMapsEnabled() {
    return false;
  }
  get debugPort() {
    return 0;
  }
  get throwDeprecation() {
    return false;
  }
  get traceDeprecation() {
    return false;
  }
  get features() {
    return {};
  }
  get release() {
    return {};
  }
  get connected() {
    return false;
  }
  get config() {
    return {};
  }
  get moduleLoadList() {
    return [];
  }
  constrainedMemory() {
    return 0;
  }
  availableMemory() {
    return 0;
  }
  uptime() {
    return 0;
  }
  resourceUsage() {
    return {};
  }
  // --- noop methods ---
  ref() {
  }
  unref() {
  }
  // --- unimplemented methods ---
  umask() {
    throw createNotImplementedError("process.umask");
  }
  getBuiltinModule() {
    return void 0;
  }
  getActiveResourcesInfo() {
    throw createNotImplementedError("process.getActiveResourcesInfo");
  }
  exit() {
    throw createNotImplementedError("process.exit");
  }
  reallyExit() {
    throw createNotImplementedError("process.reallyExit");
  }
  kill() {
    throw createNotImplementedError("process.kill");
  }
  abort() {
    throw createNotImplementedError("process.abort");
  }
  dlopen() {
    throw createNotImplementedError("process.dlopen");
  }
  setSourceMapsEnabled() {
    throw createNotImplementedError("process.setSourceMapsEnabled");
  }
  loadEnvFile() {
    throw createNotImplementedError("process.loadEnvFile");
  }
  disconnect() {
    throw createNotImplementedError("process.disconnect");
  }
  cpuUsage() {
    throw createNotImplementedError("process.cpuUsage");
  }
  setUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.setUncaughtExceptionCaptureCallback");
  }
  hasUncaughtExceptionCaptureCallback() {
    throw createNotImplementedError("process.hasUncaughtExceptionCaptureCallback");
  }
  initgroups() {
    throw createNotImplementedError("process.initgroups");
  }
  openStdin() {
    throw createNotImplementedError("process.openStdin");
  }
  assert() {
    throw createNotImplementedError("process.assert");
  }
  binding() {
    throw createNotImplementedError("process.binding");
  }
  // --- attached interfaces ---
  permission = { has: /* @__PURE__ */ notImplemented("process.permission.has") };
  report = {
    directory: "",
    filename: "",
    signal: "SIGUSR2",
    compact: false,
    reportOnFatalError: false,
    reportOnSignal: false,
    reportOnUncaughtException: false,
    getReport: /* @__PURE__ */ notImplemented("process.report.getReport"),
    writeReport: /* @__PURE__ */ notImplemented("process.report.writeReport")
  };
  finalization = {
    register: /* @__PURE__ */ notImplemented("process.finalization.register"),
    unregister: /* @__PURE__ */ notImplemented("process.finalization.unregister"),
    registerBeforeExit: /* @__PURE__ */ notImplemented("process.finalization.registerBeforeExit")
  };
  memoryUsage = Object.assign(() => ({
    arrayBuffers: 0,
    rss: 0,
    external: 0,
    heapTotal: 0,
    heapUsed: 0
  }), { rss: /* @__PURE__ */ __name(() => 0, "rss") });
  // --- undefined props ---
  mainModule = void 0;
  domain = void 0;
  // optional
  send = void 0;
  exitCode = void 0;
  channel = void 0;
  getegid = void 0;
  geteuid = void 0;
  getgid = void 0;
  getgroups = void 0;
  getuid = void 0;
  setegid = void 0;
  seteuid = void 0;
  setgid = void 0;
  setgroups = void 0;
  setuid = void 0;
  // internals
  _events = void 0;
  _eventsCount = void 0;
  _exiting = void 0;
  _maxListeners = void 0;
  _debugEnd = void 0;
  _debugProcess = void 0;
  _fatalException = void 0;
  _getActiveHandles = void 0;
  _getActiveRequests = void 0;
  _kill = void 0;
  _preload_modules = void 0;
  _rawDebug = void 0;
  _startProfilerIdleNotifier = void 0;
  _stopProfilerIdleNotifier = void 0;
  _tickCallback = void 0;
  _disconnect = void 0;
  _handleQueue = void 0;
  _pendingMessage = void 0;
  _channel = void 0;
  _send = void 0;
  _linkedBinding = void 0;
};

// node_modules/@cloudflare/unenv-preset/dist/runtime/node/process.mjs
var globalProcess = globalThis["process"];
var getBuiltinModule = globalProcess.getBuiltinModule;
var workerdProcess = getBuiltinModule("node:process");
var isWorkerdProcessV2 = globalThis.Cloudflare.compatibilityFlags.enable_nodejs_process_v2;
var unenvProcess = new Process({
  env: globalProcess.env,
  // `hrtime` is only available from workerd process v2
  hrtime: isWorkerdProcessV2 ? workerdProcess.hrtime : hrtime,
  // `nextTick` is available from workerd process v1
  nextTick: workerdProcess.nextTick
});
var { exit, features, platform } = workerdProcess;
var {
  // Always implemented by workerd
  env,
  // Only implemented in workerd v2
  hrtime: hrtime3,
  // Always implemented by workerd
  nextTick
} = unenvProcess;
var {
  _channel,
  _disconnect,
  _events,
  _eventsCount,
  _handleQueue,
  _maxListeners,
  _pendingMessage,
  _send,
  assert: assert2,
  disconnect,
  mainModule
} = unenvProcess;
var {
  // @ts-expect-error `_debugEnd` is missing typings
  _debugEnd,
  // @ts-expect-error `_debugProcess` is missing typings
  _debugProcess,
  // @ts-expect-error `_exiting` is missing typings
  _exiting,
  // @ts-expect-error `_fatalException` is missing typings
  _fatalException,
  // @ts-expect-error `_getActiveHandles` is missing typings
  _getActiveHandles,
  // @ts-expect-error `_getActiveRequests` is missing typings
  _getActiveRequests,
  // @ts-expect-error `_kill` is missing typings
  _kill,
  // @ts-expect-error `_linkedBinding` is missing typings
  _linkedBinding,
  // @ts-expect-error `_preload_modules` is missing typings
  _preload_modules,
  // @ts-expect-error `_rawDebug` is missing typings
  _rawDebug,
  // @ts-expect-error `_startProfilerIdleNotifier` is missing typings
  _startProfilerIdleNotifier,
  // @ts-expect-error `_stopProfilerIdleNotifier` is missing typings
  _stopProfilerIdleNotifier,
  // @ts-expect-error `_tickCallback` is missing typings
  _tickCallback,
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  arch,
  argv,
  argv0,
  availableMemory,
  // @ts-expect-error `binding` is missing typings
  binding,
  channel,
  chdir,
  config,
  connected,
  constrainedMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  // @ts-expect-error `domain` is missing typings
  domain,
  emit,
  emitWarning,
  eventNames,
  execArgv,
  execPath,
  exitCode,
  finalization,
  getActiveResourcesInfo,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getMaxListeners,
  getuid,
  hasUncaughtExceptionCaptureCallback,
  // @ts-expect-error `initgroups` is missing typings
  initgroups,
  kill,
  listenerCount,
  listeners,
  loadEnvFile,
  memoryUsage,
  // @ts-expect-error `moduleLoadList` is missing typings
  moduleLoadList,
  off,
  on,
  once,
  // @ts-expect-error `openStdin` is missing typings
  openStdin,
  permission,
  pid,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  // @ts-expect-error `reallyExit` is missing typings
  reallyExit,
  ref,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  send,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setMaxListeners,
  setSourceMapsEnabled,
  setuid,
  setUncaughtExceptionCaptureCallback,
  sourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  throwDeprecation,
  title,
  traceDeprecation,
  umask,
  unref,
  uptime,
  version,
  versions
} = isWorkerdProcessV2 ? workerdProcess : unenvProcess;
var _process = {
  abort,
  addListener,
  allowedNodeEnvironmentFlags,
  hasUncaughtExceptionCaptureCallback,
  setUncaughtExceptionCaptureCallback,
  loadEnvFile,
  sourceMapsEnabled,
  arch,
  argv,
  argv0,
  chdir,
  config,
  connected,
  constrainedMemory,
  availableMemory,
  cpuUsage,
  cwd,
  debugPort,
  dlopen,
  disconnect,
  emit,
  emitWarning,
  env,
  eventNames,
  execArgv,
  execPath,
  exit,
  finalization,
  features,
  getBuiltinModule,
  getActiveResourcesInfo,
  getMaxListeners,
  hrtime: hrtime3,
  kill,
  listeners,
  listenerCount,
  memoryUsage,
  nextTick,
  on,
  off,
  once,
  pid,
  platform,
  ppid,
  prependListener,
  prependOnceListener,
  rawListeners,
  release,
  removeAllListeners,
  removeListener,
  report,
  resourceUsage,
  setMaxListeners,
  setSourceMapsEnabled,
  stderr,
  stdin,
  stdout,
  title,
  throwDeprecation,
  traceDeprecation,
  umask,
  uptime,
  version,
  versions,
  // @ts-expect-error old API
  domain,
  initgroups,
  moduleLoadList,
  reallyExit,
  openStdin,
  assert: assert2,
  binding,
  send,
  exitCode,
  channel,
  getegid,
  geteuid,
  getgid,
  getgroups,
  getuid,
  setegid,
  seteuid,
  setgid,
  setgroups,
  setuid,
  permission,
  mainModule,
  _events,
  _eventsCount,
  _exiting,
  _maxListeners,
  _debugEnd,
  _debugProcess,
  _fatalException,
  _getActiveHandles,
  _getActiveRequests,
  _kill,
  _preload_modules,
  _rawDebug,
  _startProfilerIdleNotifier,
  _stopProfilerIdleNotifier,
  _tickCallback,
  _disconnect,
  _handleQueue,
  _pendingMessage,
  _channel,
  _send,
  _linkedBinding
};
var process_default = _process;

// node_modules/wrangler/_virtual_unenv_global_polyfill-@cloudflare-unenv-preset-node-process
globalThis.process = process_default;

// src/index.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400"
};
var RATE_LIMIT_REQUESTS = 60;
var RATE_LIMIT_WINDOW = 60;
async function checkRateLimit(env2, clientIP) {
  try {
    const key = `rate_limit:${clientIP}`;
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW * 1e3;
    const existing = await env2.PYRAMID_KV.get(key);
    if (!existing) {
      await env2.PYRAMID_KV.put(key, JSON.stringify([now]), { expirationTtl: RATE_LIMIT_WINDOW });
      return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 };
    }
    const requests = JSON.parse(existing);
    const validRequests = requests.filter((timestamp) => timestamp > windowStart);
    if (validRequests.length >= RATE_LIMIT_REQUESTS) {
      return { allowed: false };
    }
    validRequests.push(now);
    await env2.PYRAMID_KV.put(key, JSON.stringify(validRequests), { expirationTtl: RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - validRequests.length };
  } catch (error3) {
    console.error("Rate limiting error:", error3);
    return { allowed: true };
  }
}
__name(checkRateLimit, "checkRateLimit");
async function processImage(imageBuffer) {
  return {
    image: imageBuffer,
    thumbnail: imageBuffer
  };
}
__name(processImage, "processImage");
function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
__name(isValidUrl, "isValidUrl");
var src_default = {
  async fetch(request, env2) {
    const url = new URL(request.url);
    const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
    try {
      if (env2.FREE_TIER_MODE === "true") {
        const rateLimitResult = await checkRateLimit(env2, clientIP);
        if (!rateLimitResult.allowed) {
          return new Response(JSON.stringify({
            error: "Rate limit exceeded. Please try again later.",
            retryAfter: 60
          }), {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": "60"
            }
          });
        }
      }
      if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
      }
      if (url.pathname === "/") {
        return new Response(JSON.stringify({
          status: "Pyramid System Online",
          version: "2.0",
          features: ["text", "fonts", "full-color", "50-chars", "profile-images"],
          free_tier: env2.FREE_TIER_MODE === "true",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      if (request.method === "GET" && url.pathname === "/api/grid") {
        try {
          const cachedGrid = await env2.HistoryPyramid.get("grid-cache.json");
          if (cachedGrid) {
            return new Response(cachedGrid.body, {
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=300, s-maxage=3600",
                // 5min browser, 1hour CDN
                "ETag": `"${await env2.HistoryPyramid.get("grid-version")}"`,
                "X-Cache": "HIT"
              }
            });
          }
          const { results } = await env2.PyramidDB.prepare(`
            SELECT slot_number, price, status, owner_name, owner_message, 
                   owner_color, owner_text, owner_font, owner_image_url, owner_image_thumb, created_at
            FROM slots 
            ORDER BY slot_number
          `).all();
          const blocks = results.map((row) => ({
            id: row.slot_number,
            price: row.price,
            sold: row.status === "sold",
            owner: row.owner_name || null,
            message: row.owner_message || null,
            color: row.owner_color || "#FFD700",
            text: row.owner_text || null,
            font: row.owner_font || "Arial",
            imageUrl: row.owner_image_url || null,
            imageThumb: row.owner_image_thumb || null,
            created_at: row.created_at
          }));
          const gridData = JSON.stringify(blocks);
          const version2 = Date.now().toString();
          await Promise.all([
            env2.HistoryPyramid.put("grid-cache.json", gridData, {
              httpMetadata: { contentType: "application/json" }
            }),
            env2.HistoryPyramid.put("grid-version", version2)
          ]);
          return new Response(gridData, {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=300, s-maxage=3600",
              "ETag": `"${version2}"`,
              "X-Cache": "MISS"
            }
          });
        } catch (error3) {
          console.error("Grid fetch error:", error3);
          return new Response(JSON.stringify({
            error: "Failed to load grid data",
            blocks: []
            // Fallback to empty grid
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
      if (request.method === "POST" && url.pathname === "/api/upload-image") {
        try {
          const formData = await request.formData();
          const file = formData.get("image");
          if (!file) {
            return new Response(JSON.stringify({
              error: "No image file provided"
            }), { status: 400, headers: corsHeaders });
          }
          const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
          if (!allowedTypes.includes(file.type)) {
            return new Response(JSON.stringify({
              error: "Invalid file type. Only JPEG, PNG, WebP, and GIF allowed"
            }), { status: 400, headers: corsHeaders });
          }
          if (file.size > 5 * 1024 * 1024) {
            return new Response(JSON.stringify({
              error: "File too large. Maximum size is 5MB"
            }), { status: 400, headers: corsHeaders });
          }
          const fileExtension = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const timestamp = Date.now();
          const randomId = crypto.randomUUID().split("-")[0];
          const filename = `profile-${timestamp}-${randomId}.${fileExtension}`;
          const thumbFilename = `thumb-${filename}`;
          const imageBuffer = await file.arrayBuffer();
          const { image: optimizedImage, thumbnail } = await processImage(imageBuffer);
          await Promise.all([
            env2.HistoryPyramid.put(`images/${filename}`, optimizedImage, {
              httpMetadata: {
                contentType: file.type,
                cacheControl: "public, max-age=31536000"
                // 1 year cache
              }
            }),
            env2.HistoryPyramid.put(`images/${thumbFilename}`, thumbnail, {
              httpMetadata: {
                contentType: file.type,
                cacheControl: "public, max-age=31536000"
              }
            })
          ]);
          const imageUrl = `https://pyramid-history-bucket.workers.dev/images/${filename}`;
          const thumbUrl = `https://pyramid-history-bucket.workers.dev/images/${thumbFilename}`;
          return new Response(JSON.stringify({
            success: true,
            imageUrl,
            thumbUrl,
            filename
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error3) {
          console.error("Image upload error:", error3);
          return new Response(JSON.stringify({
            error: "Image upload failed"
          }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      if (request.method === "GET" && url.pathname.startsWith("/api/block/")) {
        const slotId = parseInt(url.pathname.split("/").pop());
        if (isNaN(slotId) || slotId < 1 || slotId > 5050) {
          return new Response(JSON.stringify({ error: "Invalid block ID" }), {
            status: 400,
            headers: corsHeaders
          });
        }
        const block = await env2.PyramidDB.prepare(`
          SELECT slot_number, price, status, owner_name, owner_message, 
                 owner_color, owner_text, owner_font, owner_image_url, owner_image_thumb, created_at
          FROM slots 
          WHERE slot_number = ?
        `).bind(slotId).first();
        if (!block) {
          return new Response(JSON.stringify({ error: "Block not found" }), {
            status: 404,
            headers: corsHeaders
          });
        }
        return new Response(JSON.stringify({
          id: block.slot_number,
          price: block.price,
          sold: block.status === "sold",
          owner: block.owner_name,
          message: block.owner_message,
          color: block.owner_color,
          text: block.owner_text,
          font: block.owner_font,
          imageUrl: block.owner_image_url,
          imageThumb: block.owner_image_thumb,
          created_at: block.created_at
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (request.method === "POST" && url.pathname === "/api/purchase") {
        try {
          const body = await request.json();
          const { slotId, user, message, color, text, font, imageUrl, paymentId } = body;
          if (!slotId || !user || !paymentId || !color) {
            return new Response(JSON.stringify({
              error: "Missing required fields: slotId, user, paymentId, color"
            }), { status: 400, headers: corsHeaders });
          }
          if (slotId < 1 || slotId > 5050) {
            return new Response(JSON.stringify({
              error: "Invalid slot ID. Must be between 1 and 5050"
            }), { status: 400, headers: corsHeaders });
          }
          if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return new Response(JSON.stringify({
              error: "Invalid color format. Use hex format like #FFD700"
            }), { status: 400, headers: corsHeaders });
          }
          if (text && text.length > 50) {
            return new Response(JSON.stringify({
              error: "Text too long. Maximum 50 characters allowed"
            }), { status: 400, headers: corsHeaders });
          }
          const allowedFonts = [
            "Arial",
            "Georgia",
            "Courier New",
            "Comic Sans MS",
            "Impact",
            "Verdana",
            "Times New Roman",
            "Trebuchet MS",
            "Lucida Console",
            "Tahoma"
          ];
          if (font && !allowedFonts.includes(font)) {
            return new Response(JSON.stringify({
              error: "Invalid font selection"
            }), { status: 400, headers: corsHeaders });
          }
          if (imageUrl && !isValidUrl(imageUrl)) {
            return new Response(JSON.stringify({
              error: "Invalid image URL format"
            }), { status: 400, headers: corsHeaders });
          }
          if (user.length > 100) {
            return new Response(JSON.stringify({
              error: "User name too long. Maximum 100 characters"
            }), { status: 400, headers: corsHeaders });
          }
          if (message && message.length > 200) {
            return new Response(JSON.stringify({
              error: "Message too long. Maximum 200 characters"
            }), { status: 400, headers: corsHeaders });
          }
          const existingPayment = await env2.PyramidDB.prepare(
            "SELECT slot_number FROM slots WHERE payment_id = ?"
          ).bind(paymentId).first();
          if (existingPayment) {
            return new Response(JSON.stringify({
              error: "Payment ID already used",
              slotId: existingPayment.slot_number
            }), { status: 409, headers: corsHeaders });
          }
          const result = await env2.PyramidDB.prepare(`
            UPDATE slots 
            SET status = 'sold', 
                owner_name = ?, 
                owner_message = ?, 
                owner_color = ?, 
                owner_text = ?, 
                owner_font = ?, 
                owner_image_url = ?, 
                owner_image_thumb = ?,
                payment_id = ?,
                updated_at = datetime('now')
            WHERE slot_number = ? AND status = 'available'
          `).bind(
            user.trim(),
            message?.trim() || "",
            color,
            text?.trim() || null,
            font || "Arial",
            imageUrl || null,
            imageUrl ? imageUrl.replace("/images/", "/images/thumb-") : null,
            paymentId,
            slotId
          ).run();
          if (result.meta.changes === 0) {
            return new Response(JSON.stringify({ error: "Slot already sold" }), {
              status: 409,
              headers: corsHeaders
            });
          }
          await Promise.all([
            env2.HistoryPyramid.delete("grid-cache.json"),
            env2.HistoryPyramid.delete("grid-version")
          ]);
          console.log(`Purchase completed: Slot ${slotId} by ${user} with payment ${paymentId}`);
          return new Response(JSON.stringify({
            success: true,
            slotId,
            message: "Purchase completed successfully"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error3) {
          console.error("Purchase error:", error3);
          return new Response(JSON.stringify({
            error: "Purchase failed. Please try again."
          }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      if (request.method === "GET" && url.pathname === "/api/stats") {
        try {
          const stats = await env2.PyramidDB.prepare(`
            SELECT 
              COUNT(*) as total_blocks,
              COUNT(CASE WHEN status = 'sold' THEN 1 END) as sold_blocks,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available_blocks,
              SUM(CASE WHEN status = 'sold' THEN price ELSE 0 END) as total_revenue,
              AVG(CASE WHEN status = 'sold' THEN price ELSE NULL END) as avg_price,
              MAX(CASE WHEN status = 'sold' THEN price ELSE NULL END) as max_price,
              MIN(CASE WHEN status = 'sold' THEN price ELSE NULL END) as min_price
            FROM slots
          `).first();
          return new Response(JSON.stringify(stats), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error3) {
          return new Response(JSON.stringify({ error: "Failed to fetch statistics" }), {
            status: 500,
            headers: corsHeaders
          });
        }
      }
      if (url.pathname === "/api/init") {
        try {
          await env2.PyramidDB.exec(`
            CREATE TABLE IF NOT EXISTS slots (
              slot_number INTEGER PRIMARY KEY,
              price INTEGER NOT NULL,
              status TEXT DEFAULT 'available' CHECK(status IN ('available', 'sold')),
              owner_name TEXT,
              owner_message TEXT,
              owner_color TEXT DEFAULT '#FFD700',
              owner_text TEXT,
              owner_font TEXT DEFAULT 'Arial',
              owner_image_url TEXT,
              owner_image_thumb TEXT,
              payment_id TEXT UNIQUE,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);
            CREATE INDEX IF NOT EXISTS idx_slots_payment ON slots(payment_id);
            CREATE INDEX IF NOT EXISTS idx_slots_owner ON slots(owner_name);
            CREATE INDEX IF NOT EXISTS idx_slots_image ON slots(owner_image_url);
          `);
          const existingCount = await env2.PyramidDB.prepare(
            "SELECT COUNT(*) as count FROM slots"
          ).first();
          if (existingCount.count === 5050) {
            return new Response(JSON.stringify({
              message: "System already initialized with 5050 slots",
              status: "ready"
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
          const stmt = env2.PyramidDB.prepare(
            "INSERT OR IGNORE INTO slots (slot_number, price) VALUES (?, ?)"
          );
          const batch = [];
          for (let i = 1; i <= 5050; i++) {
            let price = 1;
            if (i > 100) {
              price = 1 + Math.floor((i - 1) / 100) * 0.5;
            }
            price = Math.min(price, 100);
            batch.push(stmt.bind(i, Math.round(price * 100) / 100));
          }
          for (let i = 0; i < batch.length; i += 50) {
            await env2.PyramidDB.batch(batch.slice(i, i + 50));
          }
          await env2.HistoryPyramid.put("grid-version", Date.now().toString());
          return new Response(JSON.stringify({
            message: "System Initialized: 5050 Slots Ready",
            status: "ready",
            pricing: "$1.00 - $100.00",
            features: ["text", "fonts", "full-color", "50-chars"]
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        } catch (error3) {
          console.error("Init error:", error3);
          return new Response(JSON.stringify({
            error: "Initialization failed",
            details: error3.message
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
      }
      if (request.method === "POST" && url.pathname === "/api/cache/clear") {
        await Promise.all([
          env2.HistoryPyramid.delete("grid-cache.json"),
          env2.HistoryPyramid.delete("grid-version")
        ]);
        return new Response(JSON.stringify({
          message: "Cache cleared successfully"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({
        error: "Endpoint not found",
        available: ["/", "/api/grid", "/api/block/:id", "/api/purchase", "/api/stats", "/api/init"]
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      console.error("Server error:", err);
      return new Response(JSON.stringify({
        error: "Internal server error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        requestId: crypto.randomUUID()
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env2, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env2);
  } catch (e) {
    const error3 = reduceError(e);
    return Response.json(error3, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-RB6Dxf/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env2, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env2, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env2, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env2, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-RB6Dxf/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env2, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env2, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env2, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env2, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env2, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env2, ctx) => {
      this.env = env2;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
