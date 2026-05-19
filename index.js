"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const os = require("os");
const electron = require("electron");
const path$1 = require("path");
const database = require("./chunks/database-BzXAfuo6.js");
const logger = require("./chunks/logger-PEnfaXEx.js");
const contextLayerController = require("./chunks/tokenRefreshManager-2KAgK1r0.js");
const fs$1 = require("node:fs/promises");
const os$1 = require("node:os");
const path = require("node:path");
const pty = require("node-pty");
const worker_threads = require("worker_threads");
const graphDatabaseHelpers = require("./chunks/graphDatabaseHelpers-KpcBpvyI.js");
const https = require("https");
const crypto = require("crypto");
const fs$2 = require("fs");
const fs$3 = require("fs/promises");
require("child_process");
require("better-sqlite3");
const crypto$1 = require("node:crypto");
const contextPacketBuilder = require("./chunks/repoIndexer-ClVrHVUw.js");
const fs = require("node:fs");
require("node:stream/promises");
require("node:zlib");
const sessionStore = require("./chunks/sessionStore-DF2B-u6w.js");
const node_child_process = require("node:child_process");
const readline = require("node:readline");
require("node:worker_threads");
require("net");
const v8 = require("node:v8");
const indexingWorkerClient = require("./chunks/graphControllerCompatRegistry-Cs3nHUr7.js");
const graphControllerSupport = require("./chunks/graphControllerSupport-DRpTt3EV.js");
require("ws");
const codexAppServerProcess = require("./chunks/codexAppServerProcess-CjU-K8XC.js");
require("electron-store");
require("./chunks/repoMapGenerator-xjE_Kktt.js");
require("./chunks/cypherEngine-CG0y0gEQ.js");
require("./chunks/graphDatabase-BsnkIGxO.js");
require("@node-rs/xxhash");
require("express");
require("http");
require("electron-log/main");
require("vm");
require("./chunks/ptyShellIntegration-DwHApmYX.js");
require("node:util");
require("events");
require("@anthropic-ai/sdk");
require("url");
require("./chunks/gitExec-D-UU3GlS.js");
require("adm-zip");
require("./chunks/graphControllerCompatAdapters-DmHR3HH2.js");
require("@parcel/watcher");
require("vscode-languageserver-protocol");
require("vscode-jsonrpc/node");
require("node:https");
require("./chunks/rulesReader-C16rycha.js");
require("readline");
require("./chunks/concurrency-DG2cYKij.js");
function _interopNamespaceDefault(e) {
  const n = Object.create(null, { [Symbol.toStringTag]: { value: "Module" } });
  if (e) {
    for (const k in e) {
      if (k !== "default") {
        const d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: () => e[k]
        });
      }
    }
  }
  n.default = e;
  return Object.freeze(n);
}
const pty__namespace = /* @__PURE__ */ _interopNamespaceDefault(pty);
const MIN_THREADS = 16;
const MAX_THREADS = 32;
if (!process.env["UV_THREADPOOL_SIZE"]) {
  const cpuBased = os.cpus().length * 2;
  const chosen = Math.min(Math.max(cpuBased, MIN_THREADS), MAX_THREADS);
  process.env["UV_THREADPOOL_SIZE"] = String(chosen);
  console.warn("[bootstrap] UV_THREADPOOL_SIZE set to", chosen);
} else {
  console.warn("[bootstrap] UV_THREADPOOL_SIZE already set to", process.env["UV_THREADPOOL_SIZE"]);
}
const MIGRATION_MARKER_KEY = "_secrets_migrated";
async function migrateSecretsIfNeeded() {
  await contextLayerController.warmCache();
  if (!contextLayerController.isSecureStorageAvailable()) {
    logger.log.warn(
      "[SecretMigration] safeStorage unavailable — skipping. Secrets remain in plaintext config."
    );
    return;
  }
  const alreadyMigrated = database.getConfigValue(MIGRATION_MARKER_KEY);
  if (alreadyMigrated) return;
  logger.log.info("[SecretMigration] Starting plaintext secret migration...");
  let migrated = 0;
  migrated += await migrateProviderKeys();
  migrated += await migrateWebToken();
  migrated += await migrateWebPassword();
  database.setConfigValue(MIGRATION_MARKER_KEY, true);
  logger.log.info(`[SecretMigration] Complete. ${migrated} secret(s) migrated.`);
}
async function migrateProviderKeys() {
  const providers = database.getConfigValue("modelProviders") ?? [];
  const toMigrate = providers.filter((p) => p.apiKey && p.apiKey !== "••••••••");
  if (toMigrate.length === 0) return 0;
  await Promise.all(toMigrate.map((p) => contextLayerController.migrateFromPlaintext(`provider-key:${p.id}`, p.apiKey)));
  const cleaned = providers.map(
    (p) => toMigrate.some((m) => m.id === p.id) ? { ...p, apiKey: "" } : p
  );
  database.setConfigValue("modelProviders", cleaned);
  logger.log.info(`[SecretMigration] Migrated ${toMigrate.length} provider key(s)`);
  return toMigrate.length;
}
async function migrateWebToken() {
  const token = database.getConfigValue("webAccessToken");
  if (!token) return 0;
  await contextLayerController.migrateFromPlaintext("web-access-token", token);
  database.setConfigValue("webAccessToken", "");
  logger.log.info("[SecretMigration] Migrated webAccessToken");
  return 1;
}
async function migrateWebPassword() {
  const password = database.getConfigValue("webAccessPassword");
  if (!password) return 0;
  await contextLayerController.migrateFromPlaintext("web-access-password", password);
  database.setConfigValue("webAccessPassword", "");
  logger.log.info("[SecretMigration] Migrated webAccessPassword");
  return 1;
}
const SIGNALS_FILENAME = "router-quality-signals.jsonl";
const RETRAINED_WEIGHTS_FILE$1 = "router-weights-retrained.json";
const RETRAINED_WEIGHTS_BACKUP_FILE = "router-weights-retrained.backup.json";
const TRAINER_TIMEOUT_MS = 12e4;
async function backupWeightsFile(src, dest) {
  try {
    await fs.promises.copyFile(src, dest);
  } catch {
  }
}
async function countSignalLines(dataDir) {
  const filePath = `${dataDir}/${SIGNALS_FILENAME}`;
  try {
    const content = await fs.promises.readFile(filePath, "utf8");
    return content.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}
async function validateWeightFile(filePath) {
  try {
    const raw = await fs.promises.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return isValidShape(parsed);
  } catch {
    return false;
  }
}
function isValidShape(obj) {
  return (obj.type === "logistic_regression" || obj.type === "random_forest") && Array.isArray(obj.feature_names) && Array.isArray(obj.label_names);
}
function spawnTrainer(args) {
  return new Promise((resolve) => {
    let stderr = "";
    try {
      const proc = node_child_process.spawn(
        args.pythonBin,
        [args.trainerScript, "--input-dir", args.inputDir, "--output-path", args.outputPath],
        { timeout: TRAINER_TIMEOUT_MS }
      );
      proc.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });
      proc.on("error", (err) => {
        logger.log.warn("[retrain] spawn error:", err.message);
        resolve({ success: false, exitCode: null, stderr: err.message });
      });
      proc.on("close", (code) => {
        resolve({ success: code === 0, exitCode: code, stderr });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      resolve({ success: false, exitCode: null, stderr: msg });
    }
  });
}
function tierUp(tier) {
  if (tier === "HAIKU") return "SONNET";
  if (tier === "SONNET") return "OPUS";
  return "OPUS";
}
const POSITIVE_SIGNALS = /* @__PURE__ */ new Set([
  "terminal_natural_stop",
  "code_committed",
  "task_completed"
]);
const NEGATIVE_SIGNALS = /* @__PURE__ */ new Set([
  "user_abort",
  "chat_regenerate",
  "chat_correction",
  "terminal_user_abort",
  "task_interrupted"
]);
function signalToLabel(signal, routedTier) {
  if (signal.signalKind === "user_override") {
    const model = signal.meta?.userChosenModel;
    const tier = modelToTier(model);
    return tier ? { judgedTier: tier, confidence: "HIGH" } : null;
  }
  if (POSITIVE_SIGNALS.has(signal.signalKind)) {
    return { judgedTier: routedTier, confidence: "MEDIUM" };
  }
  if (NEGATIVE_SIGNALS.has(signal.signalKind)) {
    return { judgedTier: tierUp(routedTier), confidence: "MEDIUM" };
  }
  return null;
}
function modelToTier(model) {
  if (!model) return null;
  if (model.includes("haiku")) return "HAIKU";
  if (model.includes("opus")) return "OPUS";
  if (model.includes("sonnet")) return "SONNET";
  return null;
}
function confidenceRank(c) {
  if (c === "HIGH") return 3;
  if (c === "MEDIUM") return 2;
  return 1;
}
function pickHighestConfidence(labels) {
  if (labels.length === 0) return null;
  let best = labels.at(0);
  for (let i = 1; i < labels.length; i++) {
    const current = labels.at(i);
    if (current && confidenceRank(current.confidence) > confidenceRank(best.confidence)) {
      best = current;
    }
  }
  return best;
}
function buildExtractedRecord(entry) {
  return {
    id: entry.traceId,
    prompt: entry.promptFull,
    context_window: [],
    model_used: entry.model,
    interaction_type: entry.interactionType,
    workspace_hash: entry.workspaceRootHash
  };
}
function buildJudgedRecord(traceId, label, signalKind) {
  return {
    id: traceId,
    judged_tier: label.judgedTier,
    confidence: label.confidence,
    signal_kind: signalKind
  };
}
const DECISIONS_FILE = "router-decisions.jsonl";
const SIGNALS_FILE = "router-quality-signals.jsonl";
const OUTPUT_EXTRACTED = "router-full-extracted.jsonl";
const OUTPUT_JUDGED = "router-full-judged.jsonl";
async function exportTrainingData(opts) {
  const outputDir = opts.outputDir ?? opts.inputDir;
  const signals = await loadSignals(opts.inputDir);
  const signalsByTrace = indexSignalsByTrace(signals);
  const signalsBySession = indexSignalsBySession(signals);
  return writeExportFiles({
    inputDir: opts.inputDir,
    outputDir,
    maxSamples: opts.maxSamples ?? 0,
    signalsByTrace,
    signalsBySession
  });
}
function indexSignalsByTrace(signals) {
  const map = /* @__PURE__ */ new Map();
  for (const s of signals) {
    if (!s.traceId) continue;
    const arr = map.get(s.traceId) ?? [];
    arr.push(s);
    map.set(s.traceId, arr);
  }
  return map;
}
function indexSignalsBySession(signals) {
  const map = /* @__PURE__ */ new Map();
  for (const s of signals) {
    if (!s.sessionId) continue;
    const arr = map.get(s.sessionId) ?? [];
    arr.push(s);
    map.set(s.sessionId, arr);
  }
  return map;
}
async function loadSignals(dir) {
  const filePath = path.join(dir, SIGNALS_FILE);
  if (!fs.existsSync(filePath)) return [];
  return streamJsonl(filePath);
}
async function writeExportFiles(args) {
  const { inputDir, outputDir, maxSamples, signalsByTrace, signalsBySession } = args;
  const decisionsPath = path.join(inputDir, DECISIONS_FILE);
  if (!fs.existsSync(decisionsPath)) {
    return { extractedCount: 0, judgedCount: 0, outputDir };
  }
  const extractedPath = path.join(outputDir, OUTPUT_EXTRACTED);
  const judgedPath = path.join(outputDir, OUTPUT_JUDGED);
  const extractedFd = fs.openSync(extractedPath, "w");
  const judgedFd = fs.openSync(judgedPath, "w");
  let extractedCount = 0;
  let judgedCount = 0;
  const entries = await streamJsonl(decisionsPath);
  for (const entry of entries) {
    if (!isEnrichedEntry(entry)) continue;
    if (maxSamples > 0 && extractedCount >= maxSamples) break;
    writeExtracted(extractedFd, entry);
    extractedCount++;
    const label = resolveLabel(entry, signalsByTrace, signalsBySession);
    if (label) {
      writeJudged(judgedFd, entry.traceId, label.label, label.signalKind);
      judgedCount++;
    }
  }
  fs.closeSync(extractedFd);
  fs.closeSync(judgedFd);
  logger.log.info(`[exporter] wrote ${extractedCount} extracted, ${judgedCount} judged to ${outputDir}`);
  return { extractedCount, judgedCount, outputDir };
}
function resolveLabel(entry, byTrace, bySession) {
  const signals = [
    ...byTrace.get(entry.traceId) ?? [],
    ...entry.sessionId ? bySession.get(entry.sessionId) ?? [] : []
  ];
  if (signals.length === 0) return null;
  const labels = signals.map((s) => ({ derived: signalToLabel(s, entry.tier), kind: s.signalKind })).filter((x) => x.derived !== null);
  if (labels.length === 0) return null;
  const best = pickHighestConfidence(labels.map((l) => l.derived));
  if (!best) return null;
  const bestMatch = labels.find((l) => l.derived.judgedTier === best.judgedTier);
  return { label: best, signalKind: bestMatch?.kind ?? labels[0].kind };
}
function writeExtracted(fd, entry) {
  const rec = buildExtractedRecord(entry);
  fs.writeSync(fd, JSON.stringify(rec) + "\n", void 0, "utf8");
}
function writeJudged(fd, traceId, label, signalKind) {
  const rec = buildJudgedRecord(
    traceId,
    label,
    signalKind
  );
  fs.writeSync(fd, JSON.stringify(rec) + "\n", void 0, "utf8");
}
function isEnrichedEntry(obj) {
  if (!obj || typeof obj !== "object") return false;
  const rec = obj;
  return typeof rec.traceId === "string" && rec.traceId.length > 0;
}
function streamJsonl(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = fs.createReadStream(filePath, { encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      rl.close();
      stream.destroy();
    }
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        results.push(JSON.parse(trimmed));
      } catch {
      }
    });
    rl.on("close", () => {
      cleanup();
      resolve(results);
    });
    rl.on("error", (err) => {
      cleanup();
      reject(err);
    });
  });
}
const DEFAULT_MIN_SAMPLES = 50;
const DEFAULT_CHECK_INTERVAL_MS = 3e4;
const TRAINER_SCRIPT = "tools/train-router.py";
let intervalHandle = null;
let isRunning = false;
function observeDatasetGrowth(opts) {
  if (intervalHandle) return;
  const routerConfig = database.getConfigValue("routerSettings");
  if (!routerConfig?.autoRetrainEnabled) {
    logger.log.info(
      "[retrain] auto-retrain disabled (routerSettings.autoRetrainEnabled=false) — observer not started"
    );
    return;
  }
  const minSamples = DEFAULT_MIN_SAMPLES;
  const intervalMs = DEFAULT_CHECK_INTERVAL_MS;
  intervalHandle = setInterval(() => {
    void checkAndRetrain(minSamples);
  }, intervalMs);
  logger.log.info(`[retrain] observing dataset growth (min=${minSamples}, interval=${intervalMs}ms)`);
}
function stopObserving() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
async function checkAndRetrain(minSamples) {
  if (isRunning) return;
  const routerConfig = database.getConfigValue("routerSettings");
  if (!routerConfig?.enabled) return;
  if (!routerConfig?.autoRetrainEnabled) return;
  const dataDir = electron.app.getPath("userData");
  const currentCount = await countSignalLines(dataDir);
  const lastCount = getLastRetrainCount();
  if (currentCount - lastCount < minSamples) return;
  isRunning = true;
  try {
    await runRetrainPipeline(dataDir, currentCount);
  } finally {
    isRunning = false;
  }
}
async function runRetrainPipeline(dataDir, signalCount) {
  logger.log.info(`[retrain] triggering retrain (${signalCount} signals)`);
  const exportResult = await exportTrainingData({ inputDir: dataDir });
  if (exportResult.judgedCount === 0) {
    logger.log.info("[retrain] no judged entries — skipping");
    return;
  }
  const pythonBin = await contextLayerController.findPython();
  if (!pythonBin) {
    logger.log.warn("[retrain] Python not found — skipping");
    return;
  }
  const trainerScript = resolveTrainerScript();
  if (!trainerScript) {
    logger.log.warn("[retrain] trainer script not found — skipping");
    return;
  }
  const outputPath = path.join(dataDir, RETRAINED_WEIGHTS_FILE$1);
  const backupPath = path.join(dataDir, RETRAINED_WEIGHTS_BACKUP_FILE);
  const loaded = await runTrainerAndReload({
    pythonBin,
    trainerScript,
    dataDir,
    outputPath,
    backupPath
  });
  if (loaded) setLastRetrainCount(signalCount);
}
async function runTrainerAndReload(args) {
  await backupWeightsFile(args.outputPath, args.backupPath);
  const result = await spawnTrainer({
    pythonBin: args.pythonBin,
    trainerScript: args.trainerScript,
    inputDir: args.dataDir,
    outputPath: args.outputPath
  });
  if (!result.success) {
    logger.log.warn(`[retrain] trainer failed (exit=${result.exitCode}): ${result.stderr.slice(0, 200)}`);
    return false;
  }
  if (!await validateWeightFile(args.outputPath)) {
    logger.log.warn("[retrain] output weights invalid — keeping old weights");
    return false;
  }
  const loaded = contextLayerController.reloadWeights(args.outputPath);
  if (loaded) {
    logger.log.info("[retrain] weights updated successfully");
  } else {
    logger.log.warn("[retrain] reloadWeights failed — keeping old weights");
  }
  return loaded;
}
function resolveTrainerScript() {
  const devPath = path.join(electron.app.getAppPath(), TRAINER_SCRIPT);
  if (fs.existsSync(devPath)) return devPath;
  const resPath = path.join(process.resourcesPath, "train-router.py");
  if (fs.existsSync(resPath)) return resPath;
  return null;
}
function getLastRetrainCount() {
  return database.getConfigValue("routerLastRetrainCount") ?? 0;
}
function setLastRetrainCount(count) {
  database.setConfigValue("routerLastRetrainCount", count);
}
function loadRetrainedWeightsIfAvailable() {
  try {
    const weightsPath = path.join(electron.app.getPath("userData"), RETRAINED_WEIGHTS_FILE$1);
    if (!fs.existsSync(weightsPath)) return;
    const loaded = contextLayerController.reloadWeights(weightsPath);
    if (loaded) logger.log.info("[retrain] loaded retrained weights from userData");
  } catch {
  }
}
const POLL_INTERVAL_MS = 5 * 6e4;
const SPAWN_TIMEOUT_MS = 25e3;
const USAGE_DIR = path.join(os$1.homedir(), ".ouroboros");
const USAGE_FILE = path.join(USAGE_DIR, "claude-usage.json");
const ANSI_CSI = /\x1B\[[0-9;]*[A-Za-z]/g;
const ANSI_OSC = /\x1B\][^\x07]*\x07/g;
const ANSI_PRIV = /\x1B\[[?>][0-9;]*[A-Za-z]/g;
function stripAnsi(text) {
  return text.replace(ANSI_PRIV, "").replace(ANSI_CSI, "").replace(ANSI_OSC, "");
}
function parseUsageText(raw) {
  const clean = stripAnsi(raw);
  const result = {
    fiveHourUsed: null,
    sevenDayUsed: null,
    fiveHourResetsAt: null,
    sevenDayResetsAt: null
  };
  const collapsed = clean.replace(/\s+/g, "");
  const sessionMatch = /Current\s*session[\s\S]{0,300}?(\d+)\s*%\s*used/i.exec(clean) || /Currentsession[\s\S]{0,300}?(\d+)%used/i.exec(collapsed);
  if (sessionMatch) result.fiveHourUsed = parseInt(sessionMatch[1], 10);
  const weekMatch = /Current\s*week[\s\S]{0,300}?(\d+)\s*%\s*used/i.exec(clean) || /Currentweek[\s\S]{0,300}?(\d+)%used/i.exec(collapsed);
  if (weekMatch) result.sevenDayUsed = parseInt(weekMatch[1], 10);
  result.fiveHourResetsAt = extractResetText(clean, collapsed, "session");
  result.sevenDayResetsAt = extractResetText(clean, collapsed, "week");
  return result;
}
const TZ_RE = /\([A-Z]\w+\/\w+\)/;
const SESSION_RESET_RE = /Current\s*session[\s\S]{0,400}?\d+\s*%\s*used([\s\S]{0,100}?\([A-Z]\w+\/\w+\))/i;
const SESSION_RESET_COLLAPSED_RE = /Currentsession[\s\S]{0,400}?\d+%used([\s\S]{0,100}?\([A-Z]\w+\/\w+\))/i;
const WEEK_RESET_RE = /Current\s*week[\s\S]{0,400}?\d+\s*%\s*used([\s\S]{0,100}?\([A-Z]\w+\/\w+\))/i;
const WEEK_RESET_COLLAPSED_RE = /Currentweek[\s\S]{0,400}?\d+%used([\s\S]{0,100}?\([A-Z]\w+\/\w+\))/i;
function cleanResetSegment(raw) {
  const text = raw.replace(/^[a-zA-Z]+/, "").trim();
  return TZ_RE.test(text) ? text : null;
}
function extractResetText(clean, collapsed, section) {
  const spacedRe = section === "session" ? SESSION_RESET_RE : WEEK_RESET_RE;
  const collapsedRe = section === "session" ? SESSION_RESET_COLLAPSED_RE : WEEK_RESET_COLLAPSED_RE;
  const match = spacedRe.exec(clean) || collapsedRe.exec(collapsed);
  return match ? cleanResetSegment(match[1]) : null;
}
async function writeUsageFile(parsed) {
  const payload = {
    captured_at: Date.now(),
    rate_limits: {}
  };
  const limits = payload["rate_limits"];
  if (parsed.fiveHourUsed !== null) {
    limits["five_hour"] = {
      used_percentage: parsed.fiveHourUsed,
      resets_at: parsed.fiveHourResetsAt
    };
  }
  if (parsed.sevenDayUsed !== null) {
    limits["seven_day"] = {
      used_percentage: parsed.sevenDayUsed,
      resets_at: parsed.sevenDayResetsAt
    };
  }
  await fs$1.mkdir(USAGE_DIR, { recursive: true });
  await fs$1.writeFile(USAGE_FILE, JSON.stringify(payload, null, 2), "utf8");
}
function needsTrustConfirmation(clean) {
  const collapsed = clean.replace(/\s+/g, "").toLowerCase();
  return collapsed.includes("trustthisfolder") || collapsed.includes("safetycheck");
}
function dismissTrustPrompt(state, clean, term) {
  if (state.confirmedTrust || !needsTrustConfirmation(clean)) return;
  state.confirmedTrust = true;
  logger.log.info("[claude-usage-poller] trust prompt detected, confirming");
  term.write("\r");
}
function trySendUsage(state, clean, term) {
  if (state.sentUsage || !looksReady(clean)) return;
  state.sentUsage = true;
  logger.log.info("[claude-usage-poller] REPL ready, sending /usage");
  term.write("/usage\r");
}
function safeWrite(term, payload) {
  try {
    term.write(payload);
  } catch {
  }
}
function tryDismissUsageTui(state, clean, term) {
  if (!state.sentUsage || state.sentExit || !hasUsageData(clean)) return;
  state.sentExit = true;
  setTimeout(() => {
    safeWrite(term, "\x1B");
    setTimeout(() => safeWrite(term, "/exit\r"), 500);
  }, 500);
}
function handlePtyData(state, data, term) {
  state.output += data;
  const clean = stripAnsi(state.output);
  dismissTrustPrompt(state, clean, term);
  trySendUsage(state, clean, term);
  tryDismissUsageTui(state, clean, term);
}
function spawnPty(shellArgs) {
  logger.log.info("[claude-usage-poller] spawning:", shellArgs.shell, shellArgs.args);
  return pty__namespace.spawn(shellArgs.shell, shellArgs.args, {
    name: "xterm-256color",
    cols: 120,
    rows: 30,
    cwd: os$1.homedir()
  });
}
function handleExit(refs, exitCode, ctx) {
  refs.exited = true;
  clearTimeout(refs.timeout);
  refs.dataSub.dispose();
  refs.exitSub.dispose();
  activeTerm = null;
  const parsed = parseUsageText(ctx.state.output);
  logger.log.info("[claude-usage-poller] exited code:", exitCode, "parsed:", JSON.stringify(parsed));
  const result = parsed.fiveHourUsed !== null ? parsed : null;
  ctx.lastParseRef.value = result;
  ctx.finish(result, "exit");
}
function handleTimeout$1(term, refs, ctx) {
  const { state, lastParseRef, finish } = ctx;
  logger.log.warn(
    "[claude-usage-poller] timeout — trust:",
    state.confirmedTrust,
    "usage:",
    state.sentUsage,
    "exit:",
    state.sentExit
  );
  if (!refs.exited) {
    try {
      term.kill();
    } catch {
    }
  }
  const staleResult = lastParseRef.value ? { ...lastParseRef.value, stale: true } : null;
  finish(staleResult, "timeout");
}
function attachPtyHandlers(term, ctx) {
  const refs = {
    dataSub: term.onData((data) => handlePtyData(ctx.state, data, term)),
    exitSub: null,
    timeout: null,
    exited: false
  };
  refs.exitSub = term.onExit(({ exitCode }) => handleExit(refs, exitCode, ctx));
  refs.timeout = setTimeout(() => handleTimeout$1(term, refs, ctx), SPAWN_TIMEOUT_MS);
}
function spawnUsageQuery() {
  return new Promise((resolve) => {
    const state = {
      output: "",
      confirmedTrust: false,
      sentUsage: false,
      sentExit: false
    };
    const lastParseRef = { value: null };
    let resolved = false;
    const finish = (result, reason) => {
      if (resolved) return;
      resolved = true;
      const tag = reason === "timeout" && result ? "stale" : reason === "timeout" ? "null" : reason;
      logger.log.info(`[claude-usage-poller] finish(${tag}), result:`, JSON.stringify(result));
      resolve(result);
    };
    const term = spawnPty(buildShellArgs());
    activeTerm = term;
    attachPtyHandlers(term, { state, lastParseRef, finish });
  });
}
function buildShellArgs() {
  if (process.platform === "win32") {
    return { shell: "powershell.exe", args: ["-NoLogo", "-Command", "& claude"] };
  }
  return { shell: "claude", args: [] };
}
function looksReady(clean) {
  const hasPrompt = /(?:^|\n)\s*>\s*$/m.test(clean) || clean.includes("You:") || /claude-\d|opus|sonnet|haiku/i.test(clean);
  return hasPrompt && !needsTrustConfirmation(clean.slice(-300));
}
function hasUsageData(clean) {
  const collapsed = clean.replace(/\s+/g, "").toLowerCase();
  return collapsed.includes("%used") && collapsed.includes("current");
}
let intervalId = null;
let activeTerm = null;
let pollInFlight = false;
const DRAIN_TIMEOUT_MS = 3e3;
async function pollOnce() {
  if (pollInFlight || activeTerm) {
    logger.log.info("[claude-usage-poller] previous poll still active, skipping tick");
    return;
  }
  pollInFlight = true;
  try {
    const parsed = await spawnUsageQuery();
    if (parsed) {
      await writeUsageFile(parsed);
      logger.log.info("[claude-usage-poller] captured usage data");
    }
  } catch (err) {
    logger.log.warn("[claude-usage-poller] poll failed:", err);
  } finally {
    pollInFlight = false;
  }
}
function startClaudeUsagePoller() {
  if (intervalId) return;
  logger.log.info(`[claude-usage-poller] starting (interval: ${POLL_INTERVAL_MS / 1e3}s)`);
  void pollOnce();
  intervalId = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
}
async function stopClaudeUsagePoller() {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  if (activeTerm) {
    logger.log.info("[claude-usage-poller] draining in-flight PTY");
    const term = activeTerm;
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        logger.log.warn("[claude-usage-poller] drain timeout, force-killing");
        resolve();
      }, DRAIN_TIMEOUT_MS);
      term.onExit(() => {
        clearTimeout(timeout);
        resolve();
      });
      term.kill();
    });
    activeTerm = null;
  }
  logger.log.info("[claude-usage-poller] stopped");
}
function readConfig() {
  return database.getConfigValue("codemode") ?? {};
}
function isStdioCapable(config) {
  return typeof config.command === "string" && config.command.length > 0;
}
async function resolveEligibleServers(cfg, projectRoot) {
  const excludes = new Set(cfg.excludeFromMultiplex ?? []);
  const allServers = await contextLayerController.getMcpServers(projectRoot);
  const eligible = allServers.filter((e) => e.enabled).filter((e) => !excludes.has(e.name)).filter((e) => isStdioCapable(e.config));
  const skippedHttp = allServers.filter((e) => e.enabled && !isStdioCapable(e.config)).map((e) => e.name);
  return { serverNames: eligible.map((e) => e.name), skippedHttp };
}
async function enableCodeModeUserLevel(opts = {}) {
  const cfg = readConfig();
  if (cfg.enabled !== true) {
    logger.log.info("[codemode-startup] codemode.enabled is false — skipping user-level enable");
    return { success: false, error: "codemode.enabled is false" };
  }
  if (contextLayerController.isCodeModeEnabled()) {
    logger.log.info("[codemode-startup] already enabled in this process — skipping");
    return { success: true };
  }
  const { serverNames, skippedHttp } = await resolveEligibleServers(cfg, opts.projectRoot);
  if (skippedHttp.length > 0) {
    logger.log.info(`[codemode-startup] skipping HTTP-only upstreams: ${skippedHttp.join(",")}`);
  }
  if (serverNames.length === 0) {
    logger.log.info("[codemode-startup] no eligible servers to multiplex — skipping enable");
    return { success: false, error: "no eligible servers" };
  }
  logger.log.info(`[codemode-startup] enabling user-level CodeMode for: ${serverNames.join(",")}`);
  const result = await contextLayerController.enableCodeMode(serverNames, "global", opts.projectRoot);
  if (result.success) logger.log.info(`[codemode-startup] enabled — proxied: ${serverNames.join(",")}`);
  else logger.log.warn(`[codemode-startup] enable failed: ${result.error}`);
  return result;
}
async function disableCodeModeUserLevel() {
  if (!contextLayerController.isCodeModeEnabled()) {
    return;
  }
  logger.log.info("[codemode-startup] disabling user-level CodeMode (IDE shutting down)");
  try {
    const result = await contextLayerController.disableCodeMode();
    if (!result.success) {
      logger.log.warn(`[codemode-startup] disable returned error: ${result.error}`);
    }
  } catch (err) {
    logger.log.warn("[codemode-startup] disable threw (ignored):", err);
  }
}
function resolveWorkerPath() {
  const outMainDir = __dirname.endsWith("chunks") ? path$1.dirname(__dirname) : __dirname;
  return path$1.join(outMainDir, "repoMapWorker.js");
}
function buildWorkerData() {
  return { dbPath: graphDatabaseHelpers.getDbPath() };
}
class RepoMapWorkerClient {
  worker = null;
  pending = /* @__PURE__ */ new Map();
  messageQueue = [];
  ready = false;
  nextId = 0;
  // ── Public API ──────────────────────────────────────────────────────────────
  generateRepoMap(opts) {
    let storedResolve;
    let storedReject;
    const promise = new Promise((resolve, reject) => {
      storedResolve = resolve;
      storedReject = reject;
    });
    promise.catch(() => void 0);
    const id = String(this.nextId++);
    this.pending.set(id, { resolve: storedResolve, reject: storedReject, promise });
    const msg = this.buildRequest(id, opts);
    logger.log.info(`[trace:repoMap-worker] request id=${id}`);
    if (this.ready) {
      this.ensureWorker().postMessage(msg);
    } else {
      this.messageQueue.push(msg);
      this.ensureWorker();
    }
    return promise;
  }
  async dispose() {
    this.rejectAll(new Error("RepoMapWorkerClient disposed"));
    const worker = this.worker;
    this.worker = null;
    this.ready = false;
    this.messageQueue = [];
    if (!worker) return;
    try {
      await worker.terminate();
    } catch {
    }
  }
  // ── Internal ────────────────────────────────────────────────────────────────
  buildRequest(id, opts) {
    const o = opts;
    return {
      type: "generateRepoMap",
      id,
      repoFacts: o.repoFacts,
      repoIndex: o.repoIndex,
      workspaceRoot: o.workspaceRoot,
      model: o.model
    };
  }
  ensureWorker() {
    if (this.worker) return this.worker;
    logger.log.info("[trace:repoMap-worker] spawning worker");
    const worker = new worker_threads.Worker(resolveWorkerPath(), {
      workerData: buildWorkerData(),
      stdout: true,
      stderr: true
    });
    worker.stdout?.on("data", (chunk) => {
      const text = chunk.toString().trimEnd();
      if (text) logger.log.info(`[worker:repoMap] ${text}`);
    });
    worker.stderr?.on("data", (chunk) => {
      const text = chunk.toString().trimEnd();
      if (text) logger.log.warn(`[worker:repoMap] ${text}`);
    });
    worker.on("message", (msg) => {
      this.handleMessage(msg);
    });
    worker.on("error", (err) => {
      logger.log.error("[repoMapWorker] worker error:", err);
      this.rejectAll(err);
    });
    worker.on("exit", (code) => {
      if (code !== 0) {
        logger.log.warn("[trace:repoMap-worker] worker exited unexpectedly");
        logger.log.warn(`[repoMapWorker] exited with code ${code}`);
        this.rejectAll(new Error(`Worker exited with code ${code}`));
      }
      if (this.worker === worker) {
        this.worker = null;
        this.ready = false;
      }
    });
    this.worker = worker;
    return worker;
  }
  handleMessage(msg) {
    switch (msg.type) {
      case "ready":
        logger.log.info("[trace:repoMap-worker] ready");
        this.ready = true;
        this.flushQueue();
        break;
      case "repoMapReady":
        logger.log.info(`[trace:repoMap-worker] response id=${msg.id} workerMs=${msg.durationMs}`);
        this.settle(msg.id, (p) => p.resolve(msg.repoMap));
        break;
      case "error":
        logger.log.warn(`[trace:repoMap-worker] worker error id=${msg.id} message=${msg.message}`);
        this.settle(msg.id, (p) => p.reject(new Error(msg.message)));
        break;
    }
  }
  flushQueue() {
    const worker = this.worker;
    if (!worker) return;
    for (const msg of this.messageQueue) {
      worker.postMessage(msg);
    }
    this.messageQueue = [];
  }
  settle(id, fn) {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    fn(p);
  }
  rejectAll(err) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
    this.messageQueue = [];
  }
}
let _client = null;
function getRepoMapWorkerClient() {
  _client ??= new RepoMapWorkerClient();
  return _client;
}
const CRASH_SK_KEY_RE = /sk-[a-zA-Z0-9_-]{20,}/g;
const CRASH_JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
function redactPaths(input) {
  const homeDir = os.homedir();
  const escapedHome = homeDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let result = input.replace(new RegExp(escapedHome, "g"), "~");
  result = result.replace(/[A-Za-z]:\\(?:[^\\/:*?"<>|\r\n]+\\){1,3}/g, "~\\");
  result = result.replace(/\/Users\/[^/]+\//g, "~/");
  result = result.replace(CRASH_SK_KEY_RE, "[REDACTED]");
  result = result.replace(CRASH_JWT_RE, "[REDACTED]");
  return result;
}
function buildRecord(err) {
  const rawStack = err.stack ?? err.message ?? String(err);
  const rawMessage = err.message ?? String(err);
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    version: process.env.npm_package_version ?? "unknown",
    os: process.platform,
    osVersion: os.release(),
    nodeVersion: process.version,
    message: redactPaths(rawMessage),
    stack: redactPaths(rawStack)
  };
}
function getAllowInsecure() {
  const platform = database.getConfigValue("platform") ?? {};
  const crashCfg = platform.crashReports ?? {};
  return crashCfg.allowInsecure === true;
}
function postToWebhook(webhookUrl, record) {
  try {
    const parsed = new URL(webhookUrl);
    const allowInsecure = getAllowInsecure();
    if (parsed.protocol !== "https:" && !allowInsecure) return;
    const body = JSON.stringify(record);
    const options = {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
    };
    const req = https.request(webhookUrl, options, (res) => {
      logger.log.info(`[crashReporter] webhook response: ${res.statusCode}`);
    });
    req.on("error", (reqErr) => {
      logger.log.warn("[crashReporter] webhook error:", reqErr.message);
    });
    req.write(body);
    req.end();
  } catch {
    logger.log.warn("[crashReporter] failed to post to webhook");
  }
}
function handleCrash(source, err) {
  try {
    const record = buildRecord(err);
    logger.log.error(`[crashReporter] crash captured from ${source}`);
    void contextLayerController.writeCrashRecord(record);
    const platform = database.getConfigValue("platform") ?? {};
    const crashCfg = platform.crashReports ?? {};
    if (crashCfg.enabled && crashCfg.webhookUrl) {
      postToWebhook(crashCfg.webhookUrl, record);
    }
  } catch (inner) {
    logger.log.error("[crashReporter] error inside crash handler:", inner);
  }
}
let _initialised = false;
function initialiseCrashReporter() {
  if (_initialised) return;
  _initialised = true;
  process.on("uncaughtException", (err) => {
    handleCrash("main:uncaughtException", err);
  });
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    handleCrash("main:unhandledRejection", err);
  });
  logger.log.info("[crashReporter] initialised");
}
const GENERIC_EVENTS = [
  ["SessionEnd", "session_end"],
  ["StopFailure", "stop_failure"],
  ["Setup", "setup"],
  ["PostToolUseFailure", "post_tool_use_failure"],
  ["TeammateIdle", "teammate_idle"],
  ["TaskCreated", "task_created"],
  ["TaskCompleted", "task_completed"],
  ["UserPromptSubmit", "user_prompt_submit"],
  ["Elicitation", "elicitation"],
  ["ElicitationResult", "elicitation_result"],
  ["Notification", "notification"],
  ["CwdChanged", "cwd_changed"],
  ["FileChanged", "file_changed"],
  ["WorktreeCreate", "worktree_create"],
  ["WorktreeRemove", "worktree_remove"],
  ["ConfigChange", "config_change"],
  ["PreCompact", "pre_compact"],
  ["PostCompact", "post_compact"],
  ["PermissionRequest", "permission_request"],
  ["PermissionDenied", "permission_denied"]
];
function nodeCommand(scriptPath, extraArgs = "") {
  return `node "${scriptPath}"${extraArgs ? " " + extraArgs : ""}`;
}
function buildGenericHookEntries(hooksDir) {
  const result = {};
  const script = path$1.join(hooksDir, "generic_hook.mjs");
  for (const [key, wireType] of GENERIC_EVENTS) {
    result[key] = nodeCommand(script, `--type ${wireType}`);
  }
  return result;
}
function buildHookCommands(hooksDir) {
  const generic = buildGenericHookEntries(hooksDir);
  const mjs = (script) => nodeCommand(path$1.join(hooksDir, script));
  return {
    PreToolUse: mjs("pre_tool_use.mjs"),
    PostToolUse: mjs("post_tool_use.mjs"),
    SubagentStart: mjs("agent_start.mjs"),
    SubagentStop: mjs("agent_end.mjs"),
    SessionStart: mjs("session_start.mjs"),
    Stop: mjs("session_stop.mjs"),
    InstructionsLoaded: mjs("instructions_loaded.mjs"),
    ...generic
  };
}
const TELEMETRY_HOOKS = [
  { eventType: "SessionStart", scriptName: "session_start_spawn_cost.mjs" },
  { eventType: "UserPromptSubmit", scriptName: "user_prompt_submit_router_shadow.mjs" }
];
function buildTelemetryHookCommand(hooksDir, scriptName) {
  return `node "${path$1.join(hooksDir, scriptName)}"`;
}
function isCommandAlreadyPresent(matchers, command) {
  return matchers.some((m) => m.hooks?.some((h) => h.command === command));
}
function getOrCreateEventMatchers(hooks, eventType) {
  if (Array.isArray(hooks[eventType])) {
    return hooks[eventType];
  }
  hooks[eventType] = [];
  return hooks[eventType];
}
function getOrCreateHooksMap(settings) {
  if (typeof settings["hooks"] === "object" && settings["hooks"] !== null) {
    return settings["hooks"];
  }
  settings["hooks"] = {};
  return settings["hooks"];
}
function backupExists(settingsPath2) {
  const dir = path$1.dirname(settingsPath2);
  const base = path$1.basename(settingsPath2);
  try {
    const entries = fs$2.readdirSync(dir);
    return entries.some((e) => e.startsWith(`${base}.`) && e.endsWith(".bak"));
  } catch {
    return false;
  }
}
function writeFirstInstallBackup(settingsPath2) {
  if (!fs$2.existsSync(settingsPath2)) return;
  if (backupExists(settingsPath2)) return;
  const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const bakPath = `${settingsPath2}.${ts}.bak`;
  try {
    fs$2.copyFileSync(settingsPath2, bakPath);
    logger.log.info(`[hookInstallerSettings] backup written to ${bakPath}`);
  } catch (err) {
    logger.log.warn("[hookInstallerSettings] could not write backup:", err);
  }
}
function atomicWriteSettings(settingsPath2, settings) {
  const tmpPath = `${settingsPath2}.tmp`;
  const json = JSON.stringify(settings, null, 2);
  try {
    fs$2.writeFileSync(tmpPath, json, "utf8");
    try {
      const fd = fs$2.openSync(tmpPath, "r+");
      try {
        fs$2.fsyncSync(fd);
      } finally {
        fs$2.closeSync(fd);
      }
    } catch {
    }
    fs$2.renameSync(tmpPath, settingsPath2);
  } catch (err) {
    try {
      if (fs$2.existsSync(tmpPath)) fs$2.unlinkSync(tmpPath);
    } catch {
    }
    throw err;
  }
}
function mergeManifestIntoSettings(settings, hooksDir) {
  const hooks = getOrCreateHooksMap(settings);
  let added = 0;
  let alreadyPresent = 0;
  for (const spec of TELEMETRY_HOOKS) {
    const command = buildTelemetryHookCommand(hooksDir, spec.scriptName);
    const matchers = getOrCreateEventMatchers(hooks, spec.eventType);
    if (isCommandAlreadyPresent(matchers, command)) {
      alreadyPresent++;
      continue;
    }
    matchers.push({ hooks: [{ type: "command", command }] });
    added++;
  }
  return { added, alreadyPresent };
}
function registerTelemetryHooksInSettings(hooksDir) {
  const settingsPath2 = path$1.join(os.homedir(), ".claude", "settings.json");
  let settings;
  let isMalformed = false;
  try {
    settings = readClaudeSettings(settingsPath2);
    if (fs$2.existsSync(settingsPath2)) {
      try {
        JSON.parse(fs$2.readFileSync(settingsPath2, "utf8"));
      } catch {
        isMalformed = true;
      }
    }
  } catch (err) {
    logger.log.warn("[hookInstallerSettings] could not read settings.json:", err);
    return;
  }
  const needsBackup = isMalformed || !backupExists(settingsPath2);
  if (needsBackup) {
    writeFirstInstallBackup(settingsPath2);
  }
  const { added, alreadyPresent } = mergeManifestIntoSettings(settings, hooksDir);
  if (added === 0) {
    logger.log.info(
      `[hookInstallerSettings] telemetry hooks already registered (${alreadyPresent} present)`
    );
    return;
  }
  try {
    fs$2.mkdirSync(path$1.dirname(settingsPath2), { recursive: true });
    atomicWriteSettings(settingsPath2, settings);
    logger.log.info(
      `[hookInstallerSettings] registered telemetry hooks: ${added} added, ${alreadyPresent} already present`
    );
  } catch (err) {
    logger.log.warn("[hookInstallerSettings] could not write settings.json:", err);
  }
}
function buildStatusLineCommand(hooksDir) {
  const scriptPath = path$1.join(hooksDir, "statusline_capture.mjs");
  return `node "${scriptPath}"`;
}
function isOuroborosStatusLine(settings, hooksDir) {
  const sl = settings["statusLine"];
  if (!sl || typeof sl.command !== "string") return false;
  return sl.command.includes(path$1.join(hooksDir, "statusline_capture"));
}
function registerStatusLineInSettings(hooksDir) {
  const settingsPath2 = path$1.join(os.homedir(), ".claude", "settings.json");
  const settings = readClaudeSettings(settingsPath2);
  if (settings["statusLine"] && !isOuroborosStatusLine(settings, hooksDir)) {
    logger.log.info("existing statusLine found in settings.json — skipping capture registration");
    return;
  }
  settings["statusLine"] = {
    type: "command",
    command: buildStatusLineCommand(hooksDir)
  };
  fs$2.writeFileSync(settingsPath2, JSON.stringify(settings, null, 2), "utf8");
  logger.log.info("registered statusLine capture in settings.json");
}
let _cachedVersion = null;
function invalidateHookVersionCache() {
  _cachedVersion = null;
}
function getCurrentHookVersion() {
  if (_cachedVersion) return _cachedVersion;
  const assetsDir = getAssetsHooksDir();
  const hash = crypto.createHash("sha256");
  for (const entry of MJS_HOOKS) {
    const filePath = path$1.join(assetsDir, entry.src);
    try {
      hash.update(fs$2.readFileSync(filePath));
    } catch {
      hash.update(entry.src);
    }
  }
  _cachedVersion = hash.digest("hex").slice(0, 16);
  return _cachedVersion;
}
const VERSION_MARKER_FILE = ".agent-ide-version";
const MJS_HOOKS = [
  { src: "lib/ouroboros.mjs", dest: "lib/ouroboros.mjs" },
  { src: "lib/signals.mjs", dest: "lib/signals.mjs" },
  { src: "lib/telemetryQueueAppend.mjs", dest: "lib/telemetryQueueAppend.mjs" },
  { src: "pre_tool_use.mjs", dest: "pre_tool_use.mjs" },
  { src: "post_tool_use.mjs", dest: "post_tool_use.mjs" },
  { src: "agent_start.mjs", dest: "agent_start.mjs" },
  { src: "agent_end.mjs", dest: "agent_end.mjs" },
  { src: "session_start.mjs", dest: "session_start.mjs" },
  { src: "session_start_spawn_cost.mjs", dest: "session_start_spawn_cost.mjs" },
  { src: "session_stop.mjs", dest: "session_stop.mjs" },
  { src: "instructions_loaded.mjs", dest: "instructions_loaded.mjs" },
  { src: "statusline_capture.mjs", dest: "statusline_capture.mjs" },
  { src: "generic_hook.mjs", dest: "generic_hook.mjs" },
  { src: "user_prompt_submit_router_shadow.mjs", dest: "user_prompt_submit_router_shadow.mjs" }
];
const LEGACY_HOOKS = [
  "pre_tool_use.ps1",
  "pre_tool_use.sh",
  "post_tool_use.ps1",
  "post_tool_use.sh",
  "agent_start.ps1",
  "agent_start.sh",
  "agent_end.ps1",
  "agent_end.sh",
  "session_start.ps1",
  "session_start.sh",
  "session_stop.ps1",
  "session_stop.sh",
  "instructions_loaded.ps1",
  "instructions_loaded.sh",
  "statusline_capture.ps1",
  "generic_hook.ps1",
  "generic_hook.sh",
  "_token-lookup.ps1",
  "_token-lookup.sh"
];
function getClaudeHooksDir() {
  return path$1.join(os.homedir(), ".claude", "hooks");
}
function getAssetsHooksDir() {
  const candidates = [
    path$1.join(process.resourcesPath ?? "", "assets", "hooks"),
    path$1.join(electron.app.getAppPath(), "assets", "hooks"),
    path$1.join(__dirname, "..", "..", "assets", "hooks")
  ];
  for (const candidate of candidates) {
    if (fs$2.existsSync(candidate)) return candidate;
  }
  return candidates[1];
}
function readClaudeSettings(settingsPath2) {
  let settings = {};
  try {
    if (fs$2.existsSync(settingsPath2)) {
      settings = JSON.parse(fs$2.readFileSync(settingsPath2, "utf8"));
    }
  } catch {
    return {};
  }
  return typeof settings === "object" && settings !== null ? settings : {};
}
function ensureHooksMap(settings) {
  const hooks = settings["hooks"];
  if (typeof hooks === "object" && hooks !== null) {
    return hooks;
  }
  settings["hooks"] = {};
  return settings["hooks"];
}
function ensureHookMatchers(hooks, eventType) {
  if (Array.isArray(hooks[eventType])) {
    return hooks[eventType];
  }
  hooks[eventType] = [];
  return hooks[eventType];
}
function registerHookCommand(entries, command) {
  const alreadyRegistered = entries.some(
    (entry) => entry.hooks?.some((hook) => hook.command === command)
  );
  if (alreadyRegistered) return false;
  entries.push({ hooks: [{ type: "command", command }] });
  return true;
}
async function registerHooksInSettings(hooksDir) {
  const settingsPath2 = path$1.join(os.homedir(), ".claude", "settings.json");
  const settings = readClaudeSettings(settingsPath2);
  const hooks = ensureHooksMap(settings);
  for (const [eventType, command] of Object.entries(buildHookCommands(hooksDir))) {
    const entries = ensureHookMatchers(hooks, eventType);
    if (!registerHookCommand(entries, command)) continue;
    logger.log.info(`registered ${eventType} hook in settings.json`);
  }
  await fs$3.writeFile(settingsPath2, JSON.stringify(settings, null, 2), "utf8");
}
function createSkippedInstallResult(hooksDir, skippedReason) {
  return {
    installed: false,
    firstInstall: false,
    hooksDir,
    skippedReason
  };
}
async function installHookFile(entry, assetsDir, hooksDir) {
  const srcPath = path$1.join(assetsDir, entry.src);
  const destPath = path$1.join(hooksDir, entry.dest);
  const srcExists = await fs$3.access(srcPath).then(() => true).catch(() => false);
  if (!srcExists) {
    logger.log.warn(`source script not found: ${srcPath}`);
    return;
  }
  await fs$3.mkdir(path$1.dirname(destPath), { recursive: true });
  await fs$3.copyFile(srcPath, destPath);
  logger.log.info(`installed ${entry.dest} -> ${destPath}`);
}
async function removeLegacyHooks(hooksDir) {
  await Promise.all(
    LEGACY_HOOKS.map(async (name) => {
      const filePath = path$1.join(hooksDir, name);
      try {
        await fs$3.rm(filePath, { force: true });
      } catch {
      }
    })
  );
}
async function installHookFiles(assetsDir, hooksDir) {
  await fs$3.mkdir(hooksDir, { recursive: true });
  await removeLegacyHooks(hooksDir);
  await Promise.all(MJS_HOOKS.map((entry) => installHookFile(entry, assetsDir, hooksDir)));
}
async function writeVersionMarker(markerPath) {
  await fs$3.writeFile(markerPath, getCurrentHookVersion(), "utf8");
}
async function syncHooksIntoSettings(hooksDir) {
  try {
    await registerHooksInSettings(hooksDir);
    registerStatusLineInSettings(hooksDir);
  } catch (err) {
    logger.log.warn("could not update settings.json:", err);
  }
  try {
    registerTelemetryHooksInSettings(hooksDir);
  } catch (err) {
    logger.log.warn("could not register telemetry hooks in settings.json:", err);
  }
}
function maybeShowInstallNotification(firstInstall, hooksDir) {
  if (!firstInstall || !electron.Notification.isSupported()) return;
  const notification = new electron.Notification({
    title: "Ouroboros",
    body: `Hook scripts installed to ${hooksDir}.
Ouroboros will now receive live tool events from Claude Code.`,
    silent: false
  });
  notification.show();
}
function logInstallComplete(firstInstall) {
  logger.log.info(
    `${firstInstall ? "first" : "updated"} install complete — version ${getCurrentHookVersion()}`
  );
}
async function installHooks() {
  const hooksDir = getClaudeHooksDir();
  const autoInstall = database.getConfigValue("autoInstallHooks");
  if (!autoInstall) {
    return createSkippedInstallResult(hooksDir, "autoInstallHooks disabled in config");
  }
  invalidateHookVersionCache();
  const markerPath = path$1.join(hooksDir, VERSION_MARKER_FILE);
  const installedVersion = await readVersionMarker(markerPath);
  const currentVersion = getCurrentHookVersion();
  if (installedVersion === currentVersion) {
    return createSkippedInstallResult(hooksDir, `hooks already at version ${currentVersion}`);
  }
  const firstInstall = installedVersion === null;
  await installHookFiles(getAssetsHooksDir(), hooksDir);
  await writeVersionMarker(markerPath);
  await syncHooksIntoSettings(hooksDir);
  maybeShowInstallNotification(firstInstall, hooksDir);
  logInstallComplete(firstInstall);
  return { installed: true, firstInstall, hooksDir };
}
async function readVersionMarker(markerPath) {
  try {
    const content = await fs$3.readFile(markerPath, "utf8");
    return content.trim() || null;
  } catch {
    return null;
  }
}
function mcpJsonPath(projectRoot) {
  return path$1.join(projectRoot, ".mcp.json");
}
function settingsPath(projectRoot) {
  return path$1.join(projectRoot, ".claude", "settings.json");
}
function userClaudeJsonPath() {
  return path$1.join(os.homedir(), ".claude.json");
}
async function atomicWriteJson(filePath, data) {
  const tmpPath = `${filePath}.tmp`;
  const content = JSON.stringify(data, null, 2);
  await fs$3.writeFile(tmpPath, content, "utf-8");
  try {
    await fs$3.rename(tmpPath, filePath);
  } catch (renameErr) {
    try {
      await fs$3.unlink(tmpPath);
    } catch {
    }
    throw renameErr;
  }
}
async function readJsonTolerant(filePath, label) {
  let raw;
  try {
    raw = await fs$3.readFile(filePath, "utf-8");
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch {
    logger.log.warn(`[internal-mcp] ${label} exists but is not valid JSON — not overwriting`);
    return null;
  }
}
function buildOuroborosEntry(_serverPort, opts) {
  const scriptPath = opts.standaloneScriptPath;
  if (!scriptPath) {
    throw new Error("ouroboros injection requires standaloneScriptPath");
  }
  return {
    type: "stdio",
    command: process.execPath,
    args: [scriptPath],
    env: { ELECTRON_RUN_AS_NODE: "1" }
  };
}
async function writeMcpJson(projectRoot, entry) {
  const filePath = mcpJsonPath(projectRoot);
  const existing = await readJsonTolerant(filePath, ".mcp.json");
  if (existing === null) return;
  const mcpServers = existing.mcpServers ?? {};
  mcpServers["ouroboros"] = entry;
  existing.mcpServers = mcpServers;
  await atomicWriteJson(filePath, existing);
}
function ensureProjectEntry(projects, key) {
  const existing = projects[key];
  if (existing && typeof existing === "object") return existing;
  const fresh = {};
  projects[key] = fresh;
  return fresh;
}
async function enableInClaudeJson(projectRoot) {
  const filePath = userClaudeJsonPath();
  const claudeJson = await readJsonTolerant(filePath, "~/.claude.json");
  if (claudeJson === null) return;
  const projects = claudeJson.projects ?? {};
  const projectKey = path$1.normalize(projectRoot);
  const entry = ensureProjectEntry(projects, projectKey);
  const enabled = Array.isArray(entry.enabledMcpjsonServers) ? [...entry.enabledMcpjsonServers] : [];
  if (!enabled.includes("ouroboros")) {
    enabled.push("ouroboros");
  }
  entry.enabledMcpjsonServers = enabled;
  const disabled = Array.isArray(entry.disabledMcpjsonServers) ? entry.disabledMcpjsonServers.filter((s) => s !== "ouroboros") : [];
  if (disabled.length > 0) {
    entry.disabledMcpjsonServers = disabled;
  } else {
    delete entry.disabledMcpjsonServers;
  }
  claudeJson.projects = projects;
  await atomicWriteJson(filePath, claudeJson);
}
async function cleanupLegacySettingsJson(projectRoot) {
  const filePath = settingsPath(projectRoot);
  const settings = await readJsonTolerant(filePath, ".claude/settings.json");
  if (settings === null) return;
  const mcpServers = settings.mcpServers;
  if (!mcpServers || !("ouroboros" in mcpServers)) {
    return;
  }
  delete mcpServers["ouroboros"];
  if (Object.keys(mcpServers).length === 0) {
    delete settings.mcpServers;
  } else {
    settings.mcpServers = mcpServers;
  }
  await atomicWriteJson(filePath, settings);
}
async function injectIntoProjectSettings(projectRoot, serverPort, options = {}) {
  const entry = buildOuroborosEntry(serverPort, options);
  await fs$3.mkdir(projectRoot, { recursive: true });
  await writeMcpJson(projectRoot, entry);
  await enableInClaudeJson(projectRoot);
  await cleanupLegacySettingsJson(projectRoot);
}
function buildInjectOptions(mainOutDir) {
  return {
    standaloneScriptPath: path$1.join(mainOutDir, "ouroborosMcp.js")
  };
}
const CHECK_INTERVAL_MS = 200;
const JANK_THRESHOLD_MS = 150;
const HEAP_LOG_INTERVAL_MS = 6e4;
let timerId = null;
let lastTickAt = 0;
let lastHeapLogAt = 0;
let jankCount = 0;
function formatMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
function logHeapSnapshot() {
  const heap = v8.getHeapStatistics();
  logger.log.info(
    `[jank] heap: used=${formatMB(heap.used_heap_size)} total=${formatMB(heap.total_heap_size)} limit=${formatMB(heap.heap_size_limit)} external=${formatMB(heap.external_memory)}`
  );
}
function onTick() {
  const now = Date.now();
  if (lastTickAt === 0) {
    lastTickAt = now;
    return;
  }
  const elapsed = now - lastTickAt;
  const jank = elapsed - CHECK_INTERVAL_MS;
  lastTickAt = now;
  if (jank > JANK_THRESHOLD_MS) {
    jankCount++;
    logger.log.warn(
      `[jank] event loop blocked for ~${jank}ms (tick expected after ${CHECK_INTERVAL_MS}ms, arrived after ${elapsed}ms) — total janks this session: ${jankCount}`
    );
    logHeapSnapshot();
    logger.log.warn(`[jank] ${logger.describeFdPressure()}`);
  }
  if (now - lastHeapLogAt > HEAP_LOG_INTERVAL_MS) {
    lastHeapLogAt = now;
    logHeapSnapshot();
  }
}
function startJankDetector() {
  if (timerId) return;
  lastTickAt = 0;
  lastHeapLogAt = Date.now();
  timerId = setInterval(onTick, CHECK_INTERVAL_MS);
  if (timerId && typeof timerId === "object" && "unref" in timerId) {
    timerId.unref();
  }
  logger.log.info("[jank] detector started");
  logHeapSnapshot();
}
function stopJankDetector() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
  logger.log.info(`[jank] detector stopped — total janks: ${jankCount}`);
}
const GC_SCHEMA_V2_KEY = "gc_schema_v2";
const WORKTREE_SUBSTR = ".claude/worktrees/";
function purgeSkippedNodes(db) {
  if (db.getGraphMetadata(GC_SCHEMA_V2_KEY) === "done") {
    return { alreadyDone: true, projectsScanned: 0, totalPurged: 0 };
  }
  const projects = db.listAllProjects();
  let totalPurged = 0;
  db.transaction(() => {
    for (const p of projects) {
      const purged = db.deleteNodesByFilePathSubstring(p.name, WORKTREE_SUBSTR);
      if (purged > 0) {
        logger.log.info(`[graphGc] purged ${purged} stale worktree nodes from project "${p.name}"`);
        totalPurged += purged;
      }
    }
    db.setGraphMetadata(GC_SCHEMA_V2_KEY, "done");
  });
  logger.log.info(
    `[graphGc] skip-node GC complete — ${totalPurged} nodes purged across ${projects.length} projects`
  );
  return { alreadyDone: false, projectsScanned: projects.length, totalPurged };
}
function pruneExpiredProjects(db, thresholdDays) {
  const indexingWorker = indexingWorkerClient.getIndexingWorkerClient();
  if (indexingWorker?.isIndexingInProgress?.()) {
    logger.log.info("[graphGc] skipping cycle — indexing in progress");
    return { prunedCount: 0, keptCount: 0, prunedProjects: [] };
  }
  const cutoff = Date.now() - thresholdDays * 864e5;
  const projects = db.listAllProjects();
  const prunedProjects = [];
  let keptCount = 0;
  for (const p of projects) {
    if (p.last_opened_at === 0 || p.last_opened_at >= cutoff) {
      keptCount++;
      continue;
    }
    const daysAgo = Math.floor((Date.now() - p.last_opened_at) / 864e5);
    const report = db.pruneProject(p.name);
    logger.log.info(
      `Pruned graph for project ${p.name}, last opened ${daysAgo} days ago (${report.nodes} nodes, ${report.edges} edges)`
    );
    prunedProjects.push(p.name);
  }
  return { prunedCount: prunedProjects.length, keptCount, prunedProjects };
}
async function triggerContextLayerRebuildAfterGraphReady() {
  const t0 = Date.now();
  logger.log.info(
    `[trace:post-graph-forceRebuild] triggered — heapMB=${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}`
  );
  try {
    const { getContextLayerController } = await Promise.resolve().then(() => require("./chunks/tokenRefreshManager-2KAgK1r0.js")).then((n) => n.contextLayerController);
    const ctrl = getContextLayerController();
    if (!ctrl) {
      logger.log.info("[trace:post-graph-forceRebuild] no controller — skipping");
      return;
    }
    logger.log.info("[context-layer] graph index ready — triggering forceRebuild");
    await ctrl.forceRebuild();
    logger.log.info(
      `[context-layer] forceRebuild after graph-ready complete — elapsed=${Date.now() - t0}ms`
    );
  } catch (err) {
    logger.log.warn("[context-layer] post-graph-ready rebuild failed:", err);
  }
}
function buildDatedFilename(basename, date = /* @__PURE__ */ new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `${basename}-${stamp}.jsonl`;
}
async function purgeOlderThan(dir, basenameGlob, days) {
  let entries;
  try {
    entries = await fs$1.readdir(dir);
  } catch {
    return 0;
  }
  const cutoff = utcDaysAgo(days);
  const pattern = buildRetentionPattern(basenameGlob);
  let removed = 0;
  for (const entry of entries) {
    const date = extractDateFromFilename(entry, pattern);
    if (date === null) continue;
    if (date < cutoff) {
      try {
        await fs$1.unlink(path.join(dir, entry));
        removed++;
      } catch {
      }
    }
  }
  return removed;
}
async function migrateLegacyJsonl(dir, basename) {
  const legacyPath = path.join(dir, `${basename}.jsonl`);
  let stat;
  try {
    stat = await fs$1.stat(legacyPath);
  } catch {
    return;
  }
  const dated = buildDatedFilename(basename, stat.mtime);
  const datedPath = path.join(dir, dated);
  try {
    await fs$1.stat(datedPath);
    return;
  } catch {
  }
  try {
    await fs$1.rename(legacyPath, datedPath);
  } catch {
  }
}
function buildRetentionPattern(basenameGlob) {
  const escaped = basenameGlob.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}-(\\d{4}-\\d{2}-\\d{2})(?:\\.\\d+)?\\.jsonl$`);
}
function extractDateFromFilename(filename, pattern) {
  const match = pattern.exec(filename);
  if (!match) return null;
  const stamp = match[1];
  const parsed = /* @__PURE__ */ new Date(`${stamp}T00:00:00Z`);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}
function utcDaysAgo(days) {
  const now = /* @__PURE__ */ new Date();
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days)
  );
  return cutoff;
}
function bootstrapCrashReporter() {
  electron.crashReporter.start({
    uploadToServer: false,
    compress: true
  });
}
function bootstrapApp() {
  electron.app.setName("Ouroboros");
  electron.app.commandLine.appendSwitch("disable-gpu-sandbox");
  if (!electron.app.isPackaged) {
    electron.app.commandLine.appendSwitch("no-sandbox");
  }
}
function closeEditProvenance() {
  contextPacketBuilder.closeEditProvenance();
}
function scheduleJsonlRetentionPurge(userDataPath) {
  const basenames = ["context-decisions", "context-outcomes", "research-outcomes", "corrections"];
  setImmediate(() => {
    for (const base of basenames) {
      migrateLegacyJsonl(userDataPath, base).then(() => purgeOlderThan(userDataPath, base, 30)).then((n) => {
        if (n > 0) console.warn(`[jsonlRetention] purged ${n} old files for ${base}`);
      }).catch((err) => logger.log.error("[jsonlRetention] purge error", err));
    }
  });
}
async function getCrashLogDir() {
  const dir = path$1.join(electron.app.getPath("userData"), "crashes");
  await fs$3.mkdir(dir, { recursive: true });
  return dir;
}
async function writeCrashLog(source, details) {
  try {
    const dir = await getCrashLogDir();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const file = path$1.join(dir, `crash-${timestamp}.log`);
    const content = [
      `Source: ${source}`,
      `Timestamp: ${(/* @__PURE__ */ new Date()).toISOString()}`,
      `App version: ${electron.app.getVersion()}`,
      `Platform: ${process.platform} ${process.arch}`,
      "",
      details
    ].join("\n");
    await fs$3.writeFile(file, content, "utf-8");
    logger.log.error(`Logged to ${file}`);
  } catch (err) {
    logger.log.error("Failed to write crash log:", err);
  }
}
function broadcastToActiveWindows(channel, payload) {
  for (const win of contextLayerController.getAllActiveWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
  contextLayerController.broadcastToWebClients(channel, payload);
}
function registerAutoUpdaterEvents() {
  const updater = contextLayerController.getAutoUpdater();
  if (!updater) return;
  updater.on(
    "checking-for-update",
    () => broadcastToActiveWindows("updater:event", { type: "checking-for-update" })
  );
  updater.on(
    "update-available",
    (info) => broadcastToActiveWindows("updater:event", { type: "update-available", info })
  );
  updater.on(
    "update-not-available",
    (info) => broadcastToActiveWindows("updater:event", { type: "update-not-available", info })
  );
  updater.on(
    "download-progress",
    (progress) => broadcastToActiveWindows("updater:event", { type: "download-progress", progress })
  );
  updater.on(
    "update-downloaded",
    (info) => broadcastToActiveWindows("updater:event", { type: "update-downloaded", info })
  );
  updater.on("error", (err) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("HttpError")) {
      logger.log.info("Update check: no releases found (404)");
      return;
    }
    broadcastToActiveWindows("updater:event", { type: "error", error: msg });
  });
}
function scheduleAutoUpdateCheck() {
  if (!electron.app.isPackaged) return;
  const updater = contextLayerController.getAutoUpdater();
  if (!updater) return;
  setTimeout(() => {
    updater.checkForUpdates().catch((err) => {
      logger.log.info("Auto-check failed:", err.message);
    });
  }, 5e3);
}
async function seedUpdaterToken() {
  try {
    const cred = await contextLayerController.getCredential("github");
    if (cred?.type === "oauth") contextLayerController.setUpdaterGitHubToken(cred.accessToken);
  } catch {
  }
}
function configureAutoUpdater() {
  if (!contextLayerController.getAutoUpdater()) return;
  contextLayerController.configureUpdaterChannel();
  registerAutoUpdaterEvents();
  void seedUpdaterToken();
  scheduleAutoUpdateCheck();
}
async function seedGithubTokenForPty() {
  const cred = await contextLayerController.getCredential("github");
  if (cred?.type === "oauth") contextLayerController.setGithubTokenForPty(cred.accessToken);
}
async function seedGithubTokenWithRetry(maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await seedGithubTokenForPty();
      return;
    } catch (err) {
      logger.log.warn(`GitHub token seed attempt ${i + 1} failed:`, err);
      if (i < maxAttempts - 1) await new Promise((r) => setTimeout(r, 2e3));
    }
  }
}
let sharedSystem2Db = null;
function sendIndexProgress(event) {
  broadcastToActiveWindows("system2:indexProgress", event);
}
async function runInitialIndex(args) {
  const { workerClient, db, projectRoot, projectName, reason } = args;
  sendIndexProgress({ kind: "start", projectName, projectRoot, reason });
  const result = await workerClient.runIndex({
    projectRoot,
    projectName,
    incremental: false,
    onProgress: (p) => {
      sendIndexProgress({
        kind: "progress",
        projectName,
        phase: p.phase,
        filesProcessed: p.filesProcessed,
        filesTotal: p.filesTotal,
        elapsedMs: p.elapsedMs
      });
    }
  });
  if (result.success) {
    db.writeCatalogHash(projectName);
    sendIndexProgress({
      kind: "complete",
      projectName,
      filesIndexed: result.filesIndexed,
      nodesCreated: result.nodesCreated,
      durationMs: result.durationMs
    });
    logger.log.info(
      `[system2] initial index complete: ${result.filesIndexed} files, ${result.nodesCreated} nodes`
    );
    void triggerContextLayerRebuildAfterGraphReady();
  } else {
    const message = result.errors.join("; ");
    sendIndexProgress({ kind: "error", projectName, message });
    logger.log.warn("[system2] initial index failed:", message);
  }
}
function resolveIndexReason(db, projectName, gcPrunedNames) {
  if (gcPrunedNames.includes(projectName)) return "post-gc";
  const hashOk = db.verifyCatalogHash(projectName);
  if (!hashOk) {
    logger.log.info("[system2] catalog hash mismatch, triggering full rebuild");
    return "hash-mismatch";
  }
  if (db.getNodeCount(projectName) === 0) return "first-launch";
  return null;
}
function runGraphGcPasses(db) {
  const gcConfig = database.getConfigValue("codebaseGraph");
  let prunedNames = [];
  if (gcConfig?.gcEnabled) {
    const report = pruneExpiredProjects(db, gcConfig.gcDaysThreshold);
    if (report.prunedCount > 0) {
      logger.log.info(
        `[system2] GC pruned ${report.prunedCount} stale project(s): ${report.prunedProjects.join(", ")}`
      );
      prunedNames = report.prunedProjects;
    }
  }
  purgeSkippedNodes(db);
  return prunedNames;
}
async function initCodebaseGraphImpl(projectRoot) {
  const { GraphDatabase } = await Promise.resolve().then(() => require("./chunks/graphDatabase-BsnkIGxO.js")).then((n) => n.graphDatabase);
  const { IndexingPipeline } = await Promise.resolve().then(() => require("./chunks/indexingPipeline-DidEOxMa.js"));
  const { TreeSitterParser } = await Promise.resolve().then(() => require("./chunks/treeSitterParser-xFo5vYWQ.js"));
  const { QueryEngine } = await Promise.resolve().then(() => require("./chunks/queryEngine-CF8sDNbu.js"));
  const { CypherEngine } = await Promise.resolve().then(() => require("./chunks/cypherEngine-CG0y0gEQ.js"));
  const { getIndexingWorkerClient } = await Promise.resolve().then(() => require("./chunks/graphControllerCompatRegistry-Cs3nHUr7.js")).then((n) => n.indexingWorkerClient);
  const db = new GraphDatabase();
  sharedSystem2Db = db;
  graphControllerSupport.setSystem2Db(db);
  const workerClient = getIndexingWorkerClient();
  indexingWorkerClient.initCompatRegistry({
    db,
    buildQueryEngine: (name, root) => new QueryEngine(db, name, root),
    buildCypherEngine: (name) => new CypherEngine(db, name),
    workerClient
  });
  const projectName = path$1.basename(projectRoot);
  const gcPrunedNames = runGraphGcPasses(db);
  const reason = resolveIndexReason(db, projectName, gcPrunedNames);
  if (reason !== null) {
    runInitialIndex({ workerClient, db, projectRoot, projectName, reason }).catch((err) => {
      logger.log.error("[system2] initial index failed:", err);
    });
  }
  const parser = new TreeSitterParser();
  await parser.init();
  const pipeline = new IndexingPipeline(db, parser);
  const compat = await indexingWorkerClient.acquireGraphController(projectRoot, pipeline);
  graphControllerSupport.setGraphController(compat);
  db.touchProjectOpened(projectName);
  logger.log.info(`[system2] controller initialized for ${projectName}`);
}
async function disposeCodebaseGraph() {
  const { disposeAllCompat } = await Promise.resolve().then(() => require("./chunks/graphControllerCompatRegistry-Cs3nHUr7.js")).then((n) => n.graphControllerCompatRegistry);
  const { disposeAll } = await Promise.resolve().then(() => require("./chunks/graphControllerCompatRegistry-Cs3nHUr7.js")).then((n) => n.systemTwoRegistry);
  const { disposeIndexingWorkerClient } = await Promise.resolve().then(() => require("./chunks/graphControllerCompatRegistry-Cs3nHUr7.js")).then((n) => n.indexingWorkerClient);
  await disposeAllCompat();
  await disposeAll();
  await disposeIndexingWorkerClient();
  try {
    sharedSystem2Db?.close();
  } finally {
    sharedSystem2Db = null;
    graphControllerSupport.setSystem2Db(null);
  }
}
async function initCodebaseGraph() {
  const defaultRoot = database.getConfigValue("defaultProjectRoot");
  if (!defaultRoot) {
    logger.log.info("No default project root configured, skipping graph init");
    return;
  }
  try {
    await initCodebaseGraphImpl(defaultRoot);
  } catch (err) {
    logger.log.warn("Failed to start graph:", err);
  }
  contextLayerController.initConflictMonitor();
  logger.log.info("[conflictMonitor] initialized after codebase graph");
}
function bootstrapProcessHandlers(onWriteCrashLog) {
  process.on("uncaughtException", (err) => {
    logger.log.error("uncaughtException:", err);
    void onWriteCrashLog("main:uncaughtException", `${err.stack ?? err.message}`);
  });
  process.on("unhandledRejection", (reason) => {
    const msg = reason instanceof Error ? reason.stack ?? reason.message : String(reason);
    logger.log.error("unhandledRejection:", msg);
    void onWriteCrashLog("main:unhandledRejection", msg);
  });
  process.on("SIGTERM", () => electron.app.quit());
  process.on("SIGINT", () => electron.app.quit());
}
function ensureSingleInstance() {
  const gotTheLock = electron.app.requestSingleInstanceLock();
  if (!gotTheLock) {
    electron.app.quit();
    process.exit(0);
  }
}
async function sendFcmNotification(serviceAccountPath, token, payload) {
  logger.log.info(
    "[fcmAdapter] stub — would send to token hash prefix",
    token.slice(0, 8) + "…",
    "via",
    serviceAccountPath,
    "title:",
    payload.title
  );
  return { sent: false, reason: "no-fcm-backend" };
}
function isTerminal(job) {
  return job.status === "completed" || job.status === "failed";
}
function buildPayload(job) {
  const label = job.request.title || job.id;
  const status = job.status;
  const title = status === "completed" ? "Job completed" : "Job failed";
  const body = status === "completed" ? `"${label}" finished successfully.` : `"${label}" failed: ${job.error ?? "unknown error"}`;
  return { jobId: job.id, title, body, status };
}
function broadcastInAppBanner(payload) {
  const wins = electron.BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) {
      win.webContents.send("sessionDispatch:notification", payload);
    }
  }
  logger.log.info("[dispatchNotifier] in-app banner sent for job", payload.jobId);
}
function getFcmServiceAccountPath() {
  const cfg = database.getConfigValue("sessionDispatch");
  const p = cfg?.["fcmServiceAccountPath"];
  return typeof p === "string" && p.length > 0 ? p : void 0;
}
async function tryFcmPush(pushToken, payload, serviceAccountPath) {
  try {
    const result = await sendFcmNotification(serviceAccountPath, pushToken, {
      title: payload.title,
      body: payload.body,
      data: { jobId: payload.jobId, status: payload.status }
    });
    if (result.sent) {
      logger.log.info("[dispatchNotifier] FCM push sent for job", payload.jobId);
      return true;
    }
    logger.log.info("[dispatchNotifier] FCM stub/unavailable, falling back to banner", result.reason);
    return false;
  } catch (err) {
    logger.log.warn("[dispatchNotifier] FCM push error, falling back to banner:", err);
    return false;
  }
}
async function notifyJobTransition(job) {
  if (!isTerminal(job)) return;
  const payload = buildPayload(job);
  if (!job.deviceId) {
    broadcastInAppBanner(payload);
    return;
  }
  const devices = contextLayerController.listDevices();
  const device = devices.find((d) => d.id === job.deviceId);
  if (!device) {
    logger.log.info("[dispatchNotifier] device not found for job", job.id, "— skipping");
    return;
  }
  const pushToken = device.pushToken;
  const serviceAccountPath = getFcmServiceAccountPath();
  if (pushToken && serviceAccountPath) {
    const sent = await tryFcmPush(pushToken, payload, serviceAccountPath);
    if (sent) return;
  }
  broadcastInAppBanner(payload);
}
function startInterval(state, onTick2) {
  if (state.intervalId !== null) return state;
  const id = setInterval(onTick2, 250);
  return { ...state, intervalId: id };
}
function stopInterval(state) {
  if (state.intervalId === null) return state;
  clearInterval(state.intervalId);
  return { ...state, intervalId: null };
}
function registerJobTimeout(state, jobId, timeoutMs, onTimeout) {
  const existing = state.timeouts.get(jobId);
  if (existing !== void 0) clearTimeout(existing);
  const next = new Map(state.timeouts);
  const id = setTimeout(() => {
    next.delete(jobId);
    onTimeout(jobId);
  }, timeoutMs);
  next.set(jobId, id);
  return { ...state, timeouts: next };
}
function clearJobTimeout(state, jobId) {
  const id = state.timeouts.get(jobId);
  if (id === void 0) return state;
  clearTimeout(id);
  const next = new Map(state.timeouts);
  next.delete(jobId);
  return { ...state, timeouts: next };
}
function clearAllTimeouts(state) {
  for (const id of state.timeouts.values()) clearTimeout(id);
  return { ...state, timeouts: /* @__PURE__ */ new Map() };
}
function makeLifecycleState() {
  return { intervalId: null, timeouts: /* @__PURE__ */ new Map() };
}
const DISPATCH_STATUS_CHANNEL = "sessionDispatch:status";
function broadcastJobStatus(job) {
  contextLayerController.broadcast(DISPATCH_STATUS_CHANNEL, job);
}
async function buildClaudeArgs() {
  const cliArgs = [
    "-p",
    "--verbose",
    "--output-format",
    "stream-json",
    "--dangerously-skip-permissions"
  ];
  if (process.platform === "win32") {
    const { escapePowerShellArg } = await Promise.resolve().then(() => require("./chunks/tokenRefreshManager-2KAgK1r0.js")).then((n) => n.pty);
    const escaped = ["claude", ...cliArgs].map(escapePowerShellArg).join(" ");
    return { shell: "powershell.exe", args: ["-NoLogo", "-Command", `& ${escaped}`] };
  }
  return { shell: "claude", args: cliArgs };
}
async function spawnViaPtyHost(opts) {
  const { spawnAgentViaPtyHost } = await Promise.resolve().then(() => require("./chunks/tokenRefreshManager-2KAgK1r0.js")).then((n) => n.ptyHostProxyAgent);
  const res = await spawnAgentViaPtyHost(
    {
      id: opts.id,
      shell: opts.launch.shell,
      args: opts.launch.args,
      env: opts.env,
      cwd: opts.cwd,
      cols: opts.cols,
      rows: opts.rows,
      windowId: opts.win.id
    },
    opts.win,
    opts.prompt,
    void 0
  );
  if (!res.success) throw new Error(res.error ?? "PtyHost spawn failed");
  const completion = (res.result ?? Promise.resolve(null)).then(() => void 0);
  return { ptyId: opts.id, completion };
}
function attachDirectListeners(a) {
  const { id, proc, bridge, resolve, cleanupSession, sessions } = a;
  let earlyOutput = "";
  const dataSub = proc.onData((data) => {
    if (earlyOutput.length < 2e3) earlyOutput += data;
    bridge.feed(data);
  });
  const exitSub = proc.onExit(({ exitCode }) => {
    if (exitCode && exitCode !== 0) {
      logger.log.error(`[dispatchSpawn] session ${id} exited ${exitCode}. Early: ${earlyOutput.slice(0, 500)}`);
    }
    bridge.handleExit(exitCode);
    cleanupSession(id);
    resolve();
  });
  const session = sessions.get(id);
  if (session) session.disposables = [...session.disposables ?? [], dataSub, exitSub];
}
async function spawnDirect(opts) {
  const nodePty = await import("node-pty");
  const { createAgentBridge } = await Promise.resolve().then(() => require("./chunks/tokenRefreshManager-2KAgK1r0.js")).then((n) => n.ptyAgentBridge);
  const { registerSession, cleanupSession, sessions } = await Promise.resolve().then(() => require("./chunks/tokenRefreshManager-2KAgK1r0.js")).then((n) => n.pty);
  if (sessions.has(opts.id)) throw new Error(`Session ${opts.id} already exists`);
  let resolve;
  const completion = new Promise((r) => {
    resolve = r;
  });
  const bridge = createAgentBridge({ sessionId: opts.id, onEvent: void 0, onComplete: () => resolve() });
  const proc = nodePty.spawn(opts.launch.shell, opts.launch.args, {
    name: "xterm-256color",
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
    env: opts.env
  });
  registerSession({ id: opts.id, proc, cwd: opts.cwd, shell: opts.launch.shell, win: opts.win });
  attachDirectListeners({ id: opts.id, proc, bridge, resolve, cleanupSession, sessions });
  const eofChar = process.platform === "win32" ? "" : "";
  setTimeout(() => {
    if (sessions.has(opts.id)) {
      proc.write(opts.prompt);
      proc.write(eofChar);
    }
  }, 150);
  return { ptyId: opts.id, completion };
}
async function spawnAgentSession(req) {
  const wins = electron.BrowserWindow.getAllWindows();
  const win = wins[0];
  if (!win) throw new Error("No BrowserWindow available — cannot spawn dispatch session");
  const id = crypto$1.randomUUID();
  const cwd = req.worktreePath ?? req.projectPath;
  const launch = await buildClaudeArgs();
  const env = contextLayerController.buildBaseEnv({ ...contextLayerController.buildProviderEnv("agentChat") });
  const { cols, rows } = contextLayerController.resolveSpawnOptions({ cwd });
  const spawnOpts = { id, launch, env, cwd, cols, rows, prompt: req.prompt, win };
  if (database.getConfigValue("usePtyHost") === true) return spawnViaPtyHost(spawnOpts);
  return spawnDirect(spawnOpts);
}
async function killSession(ptyId) {
  try {
    const { killPty, sessions } = await Promise.resolve().then(() => require("./chunks/tokenRefreshManager-2KAgK1r0.js")).then((n) => n.pty);
    if (sessions.has(ptyId)) await killPty(ptyId);
  } catch (err) {
    logger.log.warn("[dispatchSpawn] killSession error:", err);
  }
}
const MAX_CONCURRENT_CAP = 3;
const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1e3;
const activeHandles = /* @__PURE__ */ new Map();
let lifecycle = makeLifecycleState();
let running = false;
function resolveMaxConcurrent() {
  const cfg = database.getConfigValue("sessionDispatch");
  const raw = cfg?.maxConcurrent ?? DEFAULT_MAX_CONCURRENT;
  return Math.min(Math.max(1, raw), MAX_CONCURRENT_CAP);
}
function resolveTimeoutMs() {
  const cfg = database.getConfigValue("sessionDispatch");
  return cfg?.jobTimeoutMs ?? DEFAULT_TIMEOUT_MS;
}
function transition(jobId, patch) {
  const updated = contextLayerController.updateJob(jobId, patch);
  if (updated) broadcastJobStatus(updated);
  return updated;
}
function markFailed(jobId, error) {
  lifecycle = clearJobTimeout(lifecycle, jobId);
  activeHandles.delete(jobId);
  const updated = transition(jobId, { status: "failed", error, endedAt: (/* @__PURE__ */ new Date()).toISOString() });
  if (updated) void notifyJobTransition(updated);
}
function markCompleted(jobId) {
  lifecycle = clearJobTimeout(lifecycle, jobId);
  activeHandles.delete(jobId);
  const updated = transition(jobId, { status: "completed", endedAt: (/* @__PURE__ */ new Date()).toISOString() });
  if (updated) void notifyJobTransition(updated);
}
async function maybeCreateWorktree(job) {
  const { worktreeName, projectPath } = job.request;
  if (!worktreeName) return { worktreePath: void 0, error: void 0 };
  try {
    const wm = contextLayerController.getWorktreeManager();
    const result = await wm.add(projectPath, worktreeName);
    logger.log.info(`[dispatchRunner] worktree created for job ${job.id}:`, result.path);
    return { worktreePath: result.path, error: void 0 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.log.error(`[dispatchRunner] worktree creation failed for job ${job.id}:`, msg);
    return { worktreePath: void 0, error: msg };
  }
}
function wireCompletion(job, handle) {
  handle.completion.then(() => {
    if (!activeHandles.has(job.id)) return;
    markCompleted(job.id);
  }).catch((err) => {
    if (!activeHandles.has(job.id)) return;
    markFailed(job.id, err instanceof Error ? err.message : String(err));
  });
}
async function startJob(job) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const starting = transition(job.id, { status: "starting", startedAt: now });
  if (!starting) return;
  const { worktreePath, error: wtError } = await maybeCreateWorktree(job);
  if (wtError) {
    markFailed(job.id, wtError);
    return;
  }
  let handle;
  try {
    handle = await spawnAgentSession({
      prompt: job.request.prompt,
      projectPath: job.request.projectPath,
      worktreePath
    });
  } catch (err) {
    markFailed(job.id, err instanceof Error ? err.message : String(err));
    return;
  }
  activeHandles.set(job.id, handle);
  const running_ = transition(job.id, { status: "running", sessionId: handle.ptyId });
  if (!running_) {
    activeHandles.delete(job.id);
    return;
  }
  const timeoutMs = resolveTimeoutMs();
  lifecycle = registerJobTimeout(lifecycle, job.id, timeoutMs, handleTimeout);
  wireCompletion(job, handle);
}
function handleTimeout(jobId) {
  logger.log.warn(`[dispatchRunner] job ${jobId} timed out`);
  const handle = activeHandles.get(jobId);
  activeHandles.delete(jobId);
  if (handle) void killSession(handle.ptyId);
  transition(jobId, { status: "failed", error: "timeout", endedAt: (/* @__PURE__ */ new Date()).toISOString() });
}
function handleCancel(jobId) {
  const handle = activeHandles.get(jobId);
  if (!handle) return;
  activeHandles.delete(jobId);
  lifecycle = clearJobTimeout(lifecycle, jobId);
  void killSession(handle.ptyId);
}
function tick() {
  const max = resolveMaxConcurrent();
  if (activeHandles.size >= max) return;
  const job = contextLayerController.nextQueued();
  if (!job) return;
  void startJob(job);
}
function startDispatchRunner() {
  if (running) return;
  running = true;
  contextLayerController.registerCancelHook(handleCancel);
  lifecycle = startInterval(lifecycle, tick);
  logger.log.info("[dispatchRunner] started");
}
function stopDispatchRunner() {
  if (!running) return;
  running = false;
  lifecycle = stopInterval(lifecycle);
  lifecycle = clearAllTimeouts(lifecycle);
  activeHandles.clear();
  logger.log.info("[dispatchRunner] stopped");
}
const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1e3;
function isExpired(session, now) {
  if (!session.archivedAt) return false;
  return new Date(session.archivedAt).getTime() + SEVEN_DAYS_MS < now;
}
async function removeWorktree(session) {
  if (!session.worktree || !session.worktreePath) return;
  try {
    await contextLayerController.getWorktreeManager().remove(session.worktreePath);
    logger.log.info("[sessionGc] worktree removed", session.worktreePath);
  } catch (err) {
    logger.log.warn("[sessionGc] worktree removal failed", { sessionId: session.id, err });
  }
}
async function purgeOne(session, trashAdaptor) {
  await removeWorktree(session);
  const store = sessionStore.getSessionStore();
  if (store) store.delete(session.id);
  {
    await contextLayerController.deleteFromTrash(session.id);
  }
}
async function runSessionGc(now, trashAdaptor) {
  const store = sessionStore.getSessionStore();
  if (!store) return { purged: 0 };
  const all = store.listAll();
  const expired = all.filter((s) => isExpired(s, now));
  for (const session of expired) {
    try {
      await purgeOne(session, trashAdaptor);
    } catch (err) {
      logger.log.error("[sessionGc] purge failed for", session.id, err);
    }
  }
  if (expired.length > 0) {
    logger.log.info("[sessionGc] purged", expired.length, "expired sessions");
  }
  return { purged: expired.length };
}
const THIRTY_DAYS_MS = 30 * 24 * 3600 * 1e3;
async function runSoftDeleteGc(now, store, threadStore) {
  const result = { purgedSessions: 0, purgedThreads: 0 };
  result.purgedSessions = purgeSessions(store, now);
  result.purgedThreads = await purgeThreads(threadStore, now);
  if (result.purgedSessions > 0 || result.purgedThreads > 0) {
    logger.log.info(
      "[softDeleteGc] purged",
      result.purgedSessions,
      "sessions,",
      result.purgedThreads,
      "threads"
    );
  }
  return result;
}
function isExpiredDelete(deletedAt, now) {
  if (deletedAt === void 0) return false;
  return deletedAt + THIRTY_DAYS_MS < now;
}
function purgeSessions(store, now) {
  if (!store) return 0;
  const all = store.listAll();
  const expired = all.filter((s) => isExpiredDelete(s.deletedAt, now));
  for (const s of expired) {
    try {
      store.delete(s.id);
    } catch (err) {
      logger.log.error("[softDeleteGc] session purge failed:", s.id, err);
    }
  }
  return expired.length;
}
async function purgeThreads(threadStore, now) {
  if (!threadStore) return 0;
  let count = 0;
  try {
    const threads = await threadStore.listThreads();
    const expired = threads.filter((t) => isExpiredDelete(t.deletedAt, now));
    for (const t of expired) {
      try {
        await threadStore.deleteThread(t.id);
        count++;
      } catch (err) {
        logger.log.error("[softDeleteGc] thread purge failed:", t.id, err);
      }
    }
  } catch (err) {
    logger.log.error("[softDeleteGc] listThreads failed:", err);
  }
  return count;
}
let gcInterval = null;
function getThreadStore() {
  try {
    const m = require("../agentChat/threadStore");
    return m.agentChatThreadStore ?? null;
  } catch {
    return null;
  }
}
function runAllGc() {
  const now = Date.now();
  void runSessionGc(now);
  void runSoftDeleteGc(now, sessionStore.getSessionStore(), getThreadStore());
}
function logOrphans(root, worktrees, activeWorktreePaths) {
  for (const wt of worktrees) {
    if (!wt.isMain && !activeWorktreePaths.has(wt.path)) {
      logger.log.warn("[worktree] orphaned path detected", { path: wt.path, projectRoot: root });
    }
  }
}
async function scanOrphanWorktrees() {
  const store = sessionStore.getSessionStore();
  if (!store) return;
  const sessions = store.listAll();
  const activeWorktreePaths = new Set(
    sessions.filter((s) => s.worktree && s.worktreePath).map((s) => s.worktreePath)
  );
  const roots = [...new Set(sessions.filter((s) => s.worktree).map((s) => s.projectRoot))];
  for (const root of roots) {
    try {
      const worktrees = await contextLayerController.getWorktreeManager().list(root);
      logOrphans(root, worktrees, activeWorktreePaths);
    } catch (err) {
      logger.log.warn("[worktree] orphan scan failed for root", { root, err });
    }
  }
}
async function initSessionServices() {
  sessionStore.initSessionStore();
  contextPacketBuilder.initPinnedContextStore();
  contextLayerController.initProfileStore();
  contextLayerController.initFolderStore();
  runAllGc();
  gcInterval = setInterval(runAllGc, SEVEN_DAYS_MS);
  void scanOrphanWorktrees();
  contextLayerController.loadQueue();
  if (database.getConfigValue("sessionDispatch")?.enabled) startDispatchRunner();
}
function closeSessionServices() {
  stopDispatchRunner();
  if (gcInterval) {
    clearInterval(gcInterval);
    gcInterval = null;
  }
  sessionStore.closeSessionStore();
  contextPacketBuilder.closePinnedContextStore();
  contextLayerController.closeProfileStore();
  contextLayerController.closeFolderStore();
}
async function tryShutdown(label, fn) {
  try {
    await fn();
  } catch (err) {
    logger.log.warn(`${label} shutdown error:`, err);
  }
}
async function closeWriters() {
  await contextPacketBuilder.closeDecisionWriter();
  await contextPacketBuilder.closeOutcomeWriter();
  await contextPacketBuilder.closeResearchOutcomeWriter();
  await contextLayerController.closeCorrectionWriter();
}
function closeSyncStores() {
  contextLayerController.closeOutcomeObserver();
  sessionStore.closeTelemetryStore();
  closeEditProvenance();
  stopObserving();
  contextLayerController.stopContextRetrainTrigger();
  contextLayerController.clearQualityTimers();
}
async function disposeSubsystems() {
  await tryShutdown("codebase-graph", disposeCodebaseGraph);
  await tryShutdown("codex-app-server", codexAppServerProcess.shutdownCodexAppServerProcesses);
  await tryShutdown("extension-host", contextLayerController.shutdownExtensionHost);
}
async function performWillQuitShutdown() {
  await tryShutdown("codemode-user-level", disableCodeModeUserLevel);
  closeSessionServices();
  await closeWriters();
  closeSyncStores();
  await stopClaudeUsagePoller();
  await contextLayerController.cleanupIpcHandlers();
  contextLayerController.closeCostHistoryDb();
  contextLayerController.closeThreadStore();
  contextPacketBuilder.deleteTokenFile();
  await disposeSubsystems();
}
const TOTAL_DIR_CAP_BYTES = 100 * 1024 * 1024;
function listQueueFiles$1(queueDir) {
  let entries;
  try {
    entries = fs.readdirSync(queueDir);
  } catch {
    return [];
  }
  const files = [];
  for (const name of entries) {
    const fullPath = path.join(queueDir, name);
    try {
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;
      files.push({ name, fullPath, size: stat.size, mtimeMs: stat.mtimeMs });
    } catch {
    }
  }
  return files;
}
function enforceTotalDirCap(queueDir) {
  const dropped = [];
  const files = listQueueFiles$1(queueDir);
  let total = files.reduce((sum, f) => sum + f.size, 0);
  if (total <= TOTAL_DIR_CAP_BYTES) return { dropped };
  files.sort((a, b) => a.mtimeMs - b.mtimeMs);
  for (const file of files) {
    if (total <= TOTAL_DIR_CAP_BYTES) break;
    try {
      fs.unlinkSync(file.fullPath);
      dropped.push(file.name);
      total -= file.size;
    } catch (err) {
      logger.log.warn("[telemetry-queue] cap unlink failed:", file.name, err);
    }
  }
  return { dropped };
}
function getQueueDir() {
  const home = process.env.USERPROFILE || process.env.HOME || ".";
  return path.join(home, ".ouroboros", "telemetry", "queue");
}
const handlers = /* @__PURE__ */ new Map();
function registerSurfaceHandler(surface, handler, supportedVersions = []) {
  handlers.set(surface, {
    handler,
    supportedVersions: new Set(supportedVersions)
  });
}
function getProcessedDir() {
  return path.join(path.dirname(getQueueDir()), "processed");
}
function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch (err) {
    logger.log.warn("[telemetry-drain] mkdir failed:", err);
    return false;
  }
}
function isQueueFilename(name) {
  const dot = name.lastIndexOf(".jsonl");
  if (dot < 0) return false;
  const tail = name.slice(dot + ".jsonl".length);
  if (tail === "") return true;
  if (!tail.startsWith(".")) return false;
  const num = tail.slice(1);
  return num.length > 0 && /^\d+$/.test(num);
}
function listQueueFiles(queueDir) {
  try {
    return fs.readdirSync(queueDir).filter((n) => isQueueFilename(n));
  } catch {
    return [];
  }
}
function moveAtomic(from, to) {
  try {
    fs.renameSync(from, to);
    return true;
  } catch (err) {
    logger.log.warn("[telemetry-drain] atomic move failed:", from, err);
    return false;
  }
}
function readLines(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").split("\n").filter((l) => l.length > 0);
  } catch (err) {
    logger.log.warn("[telemetry-drain] read failed:", filePath, err);
    return [];
  }
}
function parseRecord(line) {
  try {
    const obj = JSON.parse(line);
    if (typeof obj.recordId !== "string" || typeof obj.ts !== "number" || typeof obj.surface !== "string" || typeof obj.schemaVersion !== "number") {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}
async function dispatchRecord(record, result) {
  const reg = handlers.get(record.surface);
  if (!reg) {
    logger.log.warn("[telemetry-drain] no handler for surface:", record.surface);
    result.skipped += 1;
    return;
  }
  if (reg.supportedVersions.size > 0 && !reg.supportedVersions.has(record.schemaVersion)) {
    logger.log.warn(
      "[telemetry-drain] unsupported schemaVersion",
      record.schemaVersion,
      "for surface",
      record.surface
    );
    result.skipped += 1;
    return;
  }
  try {
    await reg.handler(record);
    result.imported += 1;
  } catch (err) {
    logger.log.warn("[telemetry-drain] handler threw:", record.surface, err);
    result.errored += 1;
  }
}
async function processFile(processedPath) {
  const result = { imported: 0, skipped: 0, errored: 0 };
  const lines = readLines(processedPath);
  for (const line of lines) {
    const record = parseRecord(line);
    if (!record) {
      logger.log.warn("[telemetry-drain] malformed record line skipped");
      result.skipped += 1;
      continue;
    }
    await dispatchRecord(record, result);
  }
  return result;
}
function maybeDeleteProcessed(processedPath, result) {
  if (result.errored > 0 || result.skipped > 0) {
    logger.log.info("[telemetry-drain] retaining processed file for review:", processedPath);
    return;
  }
  try {
    fs.unlinkSync(processedPath);
  } catch (err) {
    logger.log.warn("[telemetry-drain] processed-delete failed:", err);
  }
}
async function drainQueue() {
  const summary = {
    filesProcessed: 0,
    recordsImported: 0,
    recordsSkipped: 0,
    recordsErrored: 0
  };
  const queueDir = getQueueDir();
  const processedDir = getProcessedDir();
  if (!ensureDir(processedDir)) return summary;
  const names = listQueueFiles(queueDir);
  for (const name of names) {
    const from = path.join(queueDir, name);
    const to = path.join(processedDir, name);
    if (!moveAtomic(from, to)) continue;
    const result = await processFile(to);
    summary.filesProcessed += 1;
    summary.recordsImported += result.imported;
    summary.recordsSkipped += result.skipped;
    summary.recordsErrored += result.errored;
    maybeDeleteProcessed(to, result);
  }
  return summary;
}
const SPAWN_COST_SURFACE = "spawn-cost";
const SPAWN_COST_SCHEMA_VERSION = 1;
function extractSpawnId(line) {
  try {
    const rec = JSON.parse(line);
    return typeof rec.spawnId === "string" ? rec.spawnId : null;
  } catch {
    return null;
  }
}
function readExistingSpawnIds() {
  const ids = /* @__PURE__ */ new Set();
  const jsonlPath = contextLayerController.getSpawnCostJsonlPath();
  try {
    const text = fs.readFileSync(jsonlPath, "utf8");
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      const id = extractSpawnId(line);
      if (id) ids.add(id);
    }
  } catch {
  }
  return ids;
}
function isValidPayload$2(p) {
  if (typeof p !== "object" || p === null) return false;
  const obj = p;
  return typeof obj.sessionId === "string" && typeof obj.mcpConfigBytes === "number" && typeof obj.serverCount === "number" && typeof obj.tokenEstimate === "number" && Array.isArray(obj.serversIncluded);
}
function toMcpRecord(record, payload) {
  return {
    ts: record.ts,
    spawnId: payload.sessionId,
    // Hook-side values for IDE-unknown fields default to safe sentinels.
    routingDecision: payload.routingDecision ?? "omit",
    internalMcpScope: payload.internalMcpScope ?? "never",
    codemodeEnabled: payload.codemodeEnabled,
    mcpConfigBytes: payload.mcpConfigBytes,
    serverCount: payload.serverCount,
    tokenEstimate: payload.tokenEstimate,
    serversIncluded: payload.serversIncluded
  };
}
function createSpawnCostHandler(existingIds) {
  return function handleSpawnCostRecord(record) {
    const payload = record.payload;
    if (!isValidPayload$2(payload)) {
      logger.log.warn("[spawn-cost-drain] invalid payload shape — skipping", record.recordId);
      return;
    }
    if (existingIds.has(payload.sessionId)) {
      logger.log.info(
        "[spawn-cost-drain] dedup: sessionId already in JSONL — skipping",
        payload.sessionId
      );
      return;
    }
    const mcpRecord = toMcpRecord(record, payload);
    contextLayerController.emitMcpSpawnCost(mcpRecord);
    existingIds.add(payload.sessionId);
    logger.log.info("[spawn-cost-drain] emitted record for session", payload.sessionId);
  };
}
function registerSpawnCostHandler() {
  const existingIds = readExistingSpawnIds();
  logger.log.info("[spawn-cost-drain] loaded", existingIds.size, "existing spawnIds for dedup");
  registerSurfaceHandler(SPAWN_COST_SURFACE, createSpawnCostHandler(existingIds), [
    SPAWN_COST_SCHEMA_VERSION
  ]);
}
const ROUTER_SHADOW_SURFACE = "router-shadow";
const ROUTER_SHADOW_SCHEMA_VERSION = 1;
const WEIGHTS_HASH_CHARS = 12;
const ROUTER_DECISIONS_FILE = "router-decisions.jsonl";
const RETRAINED_WEIGHTS_FILE = "router-weights-retrained.json";
const BUNDLED_WEIGHTS_RELATIVE = "src/main/router/model/router-weights.json";
function isValidPayload$1(p) {
  if (typeof p !== "object" || p === null) return false;
  const obj = p;
  return typeof obj.sessionId === "string" && typeof obj.prompt === "string" && typeof obj.cwd === "string" && typeof obj.ts === "number";
}
function safeReadFile(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}
function resolveWeightsPath() {
  try {
    const userData = electron.app.getPath("userData");
    const retrained = path.join(userData, RETRAINED_WEIGHTS_FILE);
    if (safeReadFile(retrained) !== null) return retrained;
  } catch {
  }
  try {
    const appPath = electron.app.getAppPath();
    const bundled = path.join(appPath, BUNDLED_WEIGHTS_RELATIVE);
    if (safeReadFile(bundled) !== null) return bundled;
  } catch {
  }
  return null;
}
function computeWeightsVersion(weightsPath) {
  if (!weightsPath) return "unknown";
  const buf = safeReadFile(weightsPath);
  if (!buf) return "unknown";
  return crypto$1.createHash("sha256").update(buf).digest("hex").slice(0, WEIGHTS_HASH_CHARS);
}
function readLiveSessionIds(decisionsPath) {
  const set = /* @__PURE__ */ new Set();
  const buf = safeReadFile(decisionsPath);
  if (!buf) return set;
  const text = buf.toString("utf8");
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.postHoc === true) continue;
      if (typeof obj.sessionId === "string" && obj.sessionId.length > 0) {
        set.add(obj.sessionId);
      }
    } catch {
    }
  }
  return set;
}
function resolveDecisionsPath() {
  try {
    return path.join(electron.app.getPath("userData"), ROUTER_DECISIONS_FILE);
  } catch {
    return null;
  }
}
function validateRecord(record) {
  if (record.schemaVersion !== ROUTER_SHADOW_SCHEMA_VERSION) {
    logger.log.warn(
      "[router-shadow-drain] unsupported schemaVersion",
      record.schemaVersion,
      record.recordId
    );
    return null;
  }
  if (!isValidPayload$1(record.payload)) {
    logger.log.warn("[router-shadow-drain] invalid payload shape — skipping", record.recordId);
    return null;
  }
  return record.payload;
}
function createRouterShadowHandler(deps) {
  const dispatch = deps.dispatch ?? contextLayerController.shadowRouteHookEvent;
  const { liveSessionIds, weightsVersion } = deps;
  return function handleRouterShadowRecord(record) {
    const payload = validateRecord(record);
    if (!payload) return;
    if (liveSessionIds.has(payload.sessionId)) {
      logger.log.info("[router-shadow-drain] dedup: live record exists, skipping", payload.sessionId);
      return;
    }
    dispatch({
      type: "user_prompt_submit",
      sessionId: payload.sessionId,
      prompt: payload.prompt,
      cwd: payload.cwd,
      postHoc: true,
      weightsVersion
    });
    liveSessionIds.add(payload.sessionId);
  };
}
function registerRouterShadowHandler() {
  const decisionsPath = resolveDecisionsPath();
  const liveSessionIds = decisionsPath ? readLiveSessionIds(decisionsPath) : /* @__PURE__ */ new Set();
  const weightsVersion = computeWeightsVersion(resolveWeightsPath());
  logger.log.info("[router-shadow-drain] handler registered", {
    liveSessions: liveSessionIds.size,
    weightsVersion
  });
  registerSurfaceHandler(
    ROUTER_SHADOW_SURFACE,
    createRouterShadowHandler({ liveSessionIds, weightsVersion }),
    [ROUTER_SHADOW_SCHEMA_VERSION]
  );
}
const HOOK_EVENTS_SCHEMA_VERSION = 1;
const HOOK_EVENTS_SURFACE = "hook-events";
function isValidHookEventRecord(p) {
  if (typeof p !== "object" || p === null) return false;
  const obj = p;
  return typeof obj.eventType === "string" && typeof obj.sessionId === "string" && typeof obj.eventId === "string" && typeof obj.payload === "object" && obj.payload !== null;
}
function toHookPayload(record) {
  const raw = record.payload;
  return {
    ...raw,
    type: record.eventType,
    sessionId: record.sessionId,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now(),
    toolName: typeof raw.tool_name === "string" ? raw.tool_name : void 0,
    correlationId: typeof raw.correlationId === "string" ? raw.correlationId : void 0,
    ideSpawned: raw.ideSpawned === true,
    cwd: typeof raw.cwd === "string" ? raw.cwd : void 0,
    input: raw.tool_input
  };
}
function routeToTelemetryStore(payload) {
  try {
    sessionStore.getTelemetryStore()?.record(payload);
  } catch (err) {
    logger.log.warn("[hook-events-drain] telemetryStore.record error:", err);
  }
}
function routeGraphUsage(payload) {
  try {
    contextLayerController.tapGraphUsage(payload);
  } catch (err) {
    logger.log.warn("[hook-events-drain] tapGraphUsage error:", err);
  }
}
function routeEditProvenance(payload) {
  try {
    contextLayerController.tapEditProvenance(payload);
  } catch (err) {
    logger.log.warn("[hook-events-drain] tapEditProvenance error:", err);
  }
}
function routeSessionEnd(payload) {
  try {
    contextLayerController.trackSessionEnd({
      type: payload.type,
      sessionId: payload.sessionId,
      cwd: payload.cwd
    });
  } catch (err) {
    logger.log.warn("[hook-events-drain] trackSessionEnd error:", err);
  }
}
function routeTaskCompleted(payload) {
  try {
    contextLayerController.trackTaskCompleted(payload.sessionId);
  } catch (err) {
    logger.log.warn("[hook-events-drain] trackTaskCompleted error:", err);
  }
}
const SESSION_END_TYPES = /* @__PURE__ */ new Set([
  "agent_end",
  "agent_stop",
  "session_end"
]);
function dispatchByType(eventType, payload) {
  routeToTelemetryStore(payload);
  if (eventType === "pre_tool_use") {
    routeGraphUsage(payload);
    return;
  }
  if (eventType === "post_tool_use") {
    routeEditProvenance(payload);
    return;
  }
  if (SESSION_END_TYPES.has(eventType)) {
    routeSessionEnd(payload);
    return;
  }
  if (eventType === "task_completed") {
    routeTaskCompleted(payload);
    return;
  }
}
function createHookEventsHandler(seenKeys) {
  return function handleHookEventRecord(record) {
    if (!isValidHookEventRecord(record.payload)) {
      logger.log.warn("[hook-events-drain] invalid payload shape — skipping", record.recordId);
      return;
    }
    const hr = record.payload;
    const dedupKey = `${hr.sessionId}:${hr.eventId}`;
    if (seenKeys.has(dedupKey)) {
      logger.log.info("[hook-events-drain] dedup: already seen", dedupKey);
      return;
    }
    seenKeys.add(dedupKey);
    const eventType = hr.eventType;
    const knownTypes = /* @__PURE__ */ new Set([
      "pre_tool_use",
      "post_tool_use",
      "user_prompt_submit",
      "session_start",
      "session_end",
      "agent_start",
      "agent_end",
      "agent_stop",
      "task_completed"
    ]);
    if (!knownTypes.has(eventType)) {
      logger.log.warn("[hook-events-drain] unknown eventType — skipping", eventType, record.recordId);
      return;
    }
    const payload = toHookPayload(hr);
    logger.log.info("[hook-events-drain] dispatching", eventType, hr.sessionId);
    dispatchByType(eventType, payload);
  };
}
function registerHookEventsHandler() {
  const seenKeys = /* @__PURE__ */ new Set();
  logger.log.info("[hook-events-drain] registering handler (schemaVersion=1)");
  registerSurfaceHandler(HOOK_EVENTS_SURFACE, createHookEventsHandler(seenKeys), [
    HOOK_EVENTS_SCHEMA_VERSION
  ]);
}
const SPAWN_TRACE_SURFACE = "spawn-trace";
const SPAWN_TRACE_SCHEMA_VERSION = 1;
function isValidPayload(p) {
  if (typeof p !== "object" || p === null) return false;
  const obj = p;
  return typeof obj.sessionId === "string" && Array.isArray(obj.argv) && typeof obj.cwdHash === "string" && typeof obj.ts === "number";
}
function hasExistingSpawnTrace(sessionId) {
  try {
    const store = sessionStore.getTelemetryStore();
    if (!store) return false;
    const rows = store.queryTraces(sessionId);
    return rows.some((r) => r.phase === "spawn");
  } catch (err) {
    logger.log.warn("[spawn-trace-drain] dedup DB check failed for session", sessionId, err);
    return false;
  }
}
function checkAndGuard(record, seenInBatch, dbCheck) {
  if (record.schemaVersion !== SPAWN_TRACE_SCHEMA_VERSION) {
    logger.log.warn(
      "[spawn-trace-drain] unsupported schemaVersion",
      record.schemaVersion,
      record.recordId
    );
    return null;
  }
  const payload = record.payload;
  if (!isValidPayload(payload)) {
    logger.log.warn("[spawn-trace-drain] invalid payload shape — skipping", record.recordId);
    return null;
  }
  if (seenInBatch.has(payload.sessionId)) {
    logger.log.info("[spawn-trace-drain] dedup (batch): skipping", payload.sessionId);
    return null;
  }
  if (dbCheck(payload.sessionId)) {
    logger.log.info("[spawn-trace-drain] dedup (db): skipping", payload.sessionId);
    seenInBatch.add(payload.sessionId);
    return null;
  }
  return payload;
}
function createSpawnTraceHandler(seenInBatch, dbCheck = hasExistingSpawnTrace) {
  return function handleSpawnTraceRecord(record) {
    const payload = checkAndGuard(record, seenInBatch, dbCheck);
    if (!payload) return;
    sessionStore.enqueueTrace({
      traceId: record.recordId,
      sessionId: payload.sessionId,
      kind: "spawn",
      payload: { argv: sessionStore.redactArgv(payload.argv), cwdHash: payload.cwdHash, timestamp: payload.ts }
    });
    seenInBatch.add(payload.sessionId);
    logger.log.info("[spawn-trace-drain] enqueued spawn trace for session", payload.sessionId);
  };
}
function registerSpawnTraceHandler() {
  registerSurfaceHandler(SPAWN_TRACE_SURFACE, createSpawnTraceHandler(/* @__PURE__ */ new Set()), [
    SPAWN_TRACE_SCHEMA_VERSION
  ]);
  logger.log.info("[spawn-trace-drain] handler registered");
}
function registerAllTelemetryDrainHandlers() {
  registerSpawnCostHandler();
  registerHookEventsHandler();
  registerSpawnTraceHandler();
  registerRouterShadowHandler();
}
function sendMenuEvent(win, channel) {
  win.webContents.send(channel);
  contextLayerController.broadcastToWebClients(channel, void 0);
}
async function openFolderInNewWindow(win) {
  const result = await electron.dialog.showOpenDialog(win, {
    properties: ["openDirectory", "createDirectory"],
    title: "Open Folder in New Window"
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const projectRoot = result.filePaths[0];
    const newWin = contextLayerController.createWindow(projectRoot);
    contextLayerController.setWindowProjectRoot(newWin.id, projectRoot);
  }
}
function buildMacAppMenu() {
  return {
    label: electron.app.name,
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "services" },
      { type: "separator" },
      { role: "hide" },
      { role: "hideOthers" },
      { role: "unhide" },
      { type: "separator" },
      { role: "quit" }
    ]
  };
}
function buildFileMenu(win, isMac) {
  return {
    label: "File",
    submenu: [
      {
        label: "Open Folder…",
        accelerator: "CmdOrCtrl+O",
        click: () => sendMenuEvent(win, "menu:open-folder")
      },
      { type: "separator" },
      { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => contextLayerController.createWindow() },
      { label: "Open in New Window…", click: async () => openFolderInNewWindow(win) },
      { type: "separator" },
      {
        label: "New Terminal",
        accelerator: "CmdOrCtrl+T",
        click: () => sendMenuEvent(win, "menu:new-terminal")
      },
      { type: "separator" },
      isMac ? { role: "close" } : { role: "quit" }
    ]
  };
}
function buildEditMenu(isMac) {
  return {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      ...isMac ? [
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" }
      ] : [
        { role: "delete" },
        { type: "separator" },
        { role: "selectAll" }
      ]
    ]
  };
}
function openDedicatedChat(win) {
  const focused = electron.BrowserWindow.getFocusedWindow() ?? win;
  const managed = contextLayerController.getAllWindows().find((mw) => mw.win.id === focused.id);
  const sessionId = managed?.activeSessionId;
  if (sessionId) {
    contextLayerController.createChatWindow(sessionId);
  } else {
    sendMenuEvent(focused, "menu:open-chat-window-no-session");
  }
}
function buildViewMenu(win) {
  return {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
      { type: "separator" },
      {
        label: "Command Palette",
        accelerator: "CmdOrCtrl+Shift+P",
        click: () => sendMenuEvent(win, "menu:command-palette")
      },
      { type: "separator" },
      {
        label: "Open Dedicated Chat",
        accelerator: "CommandOrControl+Shift+O",
        click: () => openDedicatedChat(win)
      },
      {
        label: "Open Side Chat",
        accelerator: "CmdOrCtrl+;",
        click: () => sendMenuEvent(win, "menu:toggle-side-chat")
      },
      { type: "separator" },
      {
        label: "Settings",
        accelerator: "CmdOrCtrl+,",
        click: () => sendMenuEvent(win, "menu:settings")
      }
    ]
  };
}
function buildWindowMenu(isMac) {
  return {
    label: "Window",
    submenu: [
      { role: "minimize" },
      { role: "zoom" },
      ...isMac ? [
        { type: "separator" },
        { role: "front" },
        { type: "separator" },
        { role: "window" }
      ] : [{ role: "close" }]
    ]
  };
}
function buildHelpMenu() {
  return {
    role: "help",
    submenu: [
      {
        label: "Learn More",
        click: async () => electron.shell.openExternal("https://claude.ai/claude-code")
      },
      { label: "Open Logs Folder", click: async () => electron.shell.openPath(electron.app.getPath("logs")) }
    ]
  };
}
function buildApplicationMenu(win) {
  const isMac = process.platform === "darwin";
  const template = [
    ...isMac ? [buildMacAppMenu()] : [],
    buildFileMenu(win, isMac),
    buildEditMenu(isMac),
    buildViewMenu(win),
    buildWindowMenu(isMac),
    buildHelpMenu()
  ];
  const menu = electron.Menu.buildFromTemplate(template);
  electron.Menu.setApplicationMenu(menu);
}
const SCHEME = "thread://";
function parsePermalink(url) {
  if (typeof url !== "string" || !url.startsWith(SCHEME)) return null;
  const body = url.slice(SCHEME.length);
  if (!body) return null;
  const hashIdx = body.indexOf("#");
  const rawThreadId = hashIdx === -1 ? body : body.slice(0, hashIdx);
  const fragment = hashIdx === -1 ? "" : body.slice(hashIdx + 1);
  const threadId = safeDecode(rawThreadId);
  if (!threadId) return null;
  const messageId = extractMessageId(fragment);
  return messageId ? { threadId, messageId } : { threadId };
}
function extractMessageId(fragment) {
  if (!fragment.startsWith("msg=")) return void 0;
  const raw = fragment.slice(4);
  if (!raw) return void 0;
  return safeDecode(raw);
}
function safeDecode(s) {
  try {
    const decoded = decodeURIComponent(s);
    return decoded.length > 0 ? decoded : void 0;
  } catch {
    return void 0;
  }
}
const PROTOCOL = "thread";
function registerThreadProtocol() {
  if (process.env.NODE_ENV !== "development") {
    try {
      electron.app.setAsDefaultProtocolClient(PROTOCOL);
    } catch (err) {
      logger.log.warn("[protocolHandler] setAsDefaultProtocolClient failed", err);
    }
  }
  electron.app.on("open-url", (event, url) => {
    event.preventDefault();
    dispatchPermalink(url);
  });
}
function setupThreadProtocol() {
  registerThreadProtocol();
  scheduleInitialPermalinkFromArgv();
}
function extractPermalinkFromArgv(argv) {
  for (const arg of argv) {
    if (typeof arg !== "string") continue;
    if (!arg.startsWith(`${PROTOCOL}://`)) continue;
    const parsed = parsePermalink(arg);
    if (parsed) return parsed;
  }
  return null;
}
function dispatchPermalink(url) {
  const parsed = parsePermalink(url);
  if (!parsed) {
    logger.log.warn("[protocolHandler] ignoring malformed permalink", url);
    return;
  }
  sendToFocusedWindow(parsed);
}
function dispatchPermalinkFromArgv(argv) {
  const parsed = extractPermalinkFromArgv(argv);
  if (parsed) sendToFocusedWindow(parsed);
}
function scheduleInitialPermalinkFromArgv() {
  const parsed = extractPermalinkFromArgv(process.argv);
  if (!parsed) return;
  electron.app.whenReady().then(() => {
    setTimeout(() => sendToFocusedWindow(parsed), 500);
  }).catch(() => {
  });
}
function sendToFocusedWindow(parsed) {
  const windows = electron.BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed());
  if (windows.length === 0) return;
  const target = electron.BrowserWindow.getFocusedWindow() ?? windows[windows.length - 1];
  target.webContents.send("app:navigateToPermalink", parsed);
}
function registerBuiltinProviders() {
  contextLayerController.registerSessionProvider(new contextLayerController.ClaudeSessionProvider());
  logger.log.info("[providers] ClaudeSessionProvider registered");
}
const PURGE_INTERVAL_MS = 24 * 60 * 60 * 1e3;
let _purgeHandle = null;
function scheduleResearchCachePurge(userDataPath) {
  const dbPath = path$1.join(userDataPath, "research-cache.db");
  const runPurge = () => {
    try {
      const cache = contextLayerController.getResearchCache(dbPath);
      const deleted = cache.purgeExpired();
      if (deleted > 0) logger.log.info(`[researchCache] purged ${deleted} expired entries`);
    } catch (err) {
      logger.log.warn("[researchCache] purge error:", err);
    }
  };
  setImmediate(runPurge);
  _purgeHandle = setInterval(runPurge, PURGE_INTERVAL_MS);
  if (typeof _purgeHandle === "object" && _purgeHandle !== null && "unref" in _purgeHandle) {
    _purgeHandle.unref();
  }
}
function ensureGraphSchema(db) {
  if (database.getSchemaVersion(db) >= 1) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL,
      filePath TEXT NOT NULL, line INTEGER NOT NULL, endLine INTEGER, metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
    CREATE INDEX IF NOT EXISTS idx_nodes_filePath ON nodes(filePath);
    CREATE TABLE IF NOT EXISTS edges (
      rowid INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL,
      target TEXT NOT NULL, type TEXT NOT NULL, metadata TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
    CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
  `);
  database.setSchemaVersion(db, 1);
}
function insertGraphData(db, data) {
  const insertNode = db.prepare(
    `INSERT OR REPLACE INTO nodes (id, type, name, filePath, line, endLine, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEdge = db.prepare(
    `INSERT INTO edges (source, target, type, metadata) VALUES (?, ?, ?, ?)`
  );
  database.runTransaction(db, () => {
    for (const n of data.nodes) {
      insertNode.run(
        n.id,
        n.type,
        n.name,
        n.filePath,
        n.line,
        n.endLine ?? null,
        n.metadata ? JSON.stringify(n.metadata) : null
      );
    }
    for (const e of data.edges ?? []) {
      insertEdge.run(e.source, e.target, e.type, e.metadata ? JSON.stringify(e.metadata) : null);
    }
  });
}
function migrateGraphStore(projectRoot) {
  const jsonPath = path$1.join(projectRoot, ".ouroboros", "graph.json");
  const bakPath = jsonPath + ".bak";
  if (!fs$2.existsSync(jsonPath) || fs$2.existsSync(bakPath)) return;
  let data;
  try {
    data = JSON.parse(fs$2.readFileSync(jsonPath, "utf-8"));
    if (!Array.isArray(data.nodes)) return;
  } catch {
    return;
  }
  let db = null;
  try {
    db = database.openDatabase(path$1.join(projectRoot, ".ouroboros", "graph.db"));
    ensureGraphSchema(db);
    insertGraphData(db, data);
    fs$2.renameSync(jsonPath, bakPath);
    logger.log.info(
      `Graph store: migrated ${data.nodes.length} nodes, ${(data.edges ?? []).length} edges`
    );
  } catch (err) {
    logger.log.warn("Graph store migration failed:", err);
  } finally {
    database.closeDatabase(db);
  }
}
function ensureThreadSchema(db) {
  if (database.getSchemaVersion(db) >= 1) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS threads (
      id TEXT PRIMARY KEY, workspaceRoot TEXT NOT NULL,
      createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL,
      title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'idle',
      latestOrchestration TEXT, branchInfo TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_threads_workspace ON threads(workspaceRoot);
    CREATE INDEX IF NOT EXISTS idx_threads_updated ON threads(updatedAt DESC);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT NOT NULL, threadId TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      role TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', createdAt INTEGER NOT NULL,
      statusKind TEXT, orchestration TEXT, contextSummary TEXT,
      verificationPreview TEXT, error TEXT, toolsSummary TEXT,
      costSummary TEXT, durationSummary TEXT, tokenUsage TEXT, blocks TEXT,
      PRIMARY KEY (id, threadId)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(threadId, createdAt ASC);
  `);
  database.setSchemaVersion(db, 1);
}
function insertThreadMessages(insertMsg, threadId, msgs) {
  const s = (v) => v ? JSON.stringify(v) : null;
  for (const m of msgs) {
    insertMsg.run(
      m.id,
      threadId,
      m.role,
      m.content ?? "",
      m.createdAt ?? 0,
      m.statusKind ?? null,
      s(m.orchestration),
      s(m.contextSummary),
      s(m.verificationPreview),
      s(m.error),
      m.toolsSummary ?? null,
      m.costSummary ?? null,
      m.durationSummary ?? null,
      s(m.tokenUsage),
      s(m.blocks)
    );
  }
}
function migrateOneThreadFile(db, insertThread, insertMsg, filePath) {
  const raw = fs$2.readFileSync(filePath, "utf-8");
  const thread = JSON.parse(raw);
  if (!thread.id) return false;
  const msgs = thread.messages ?? [];
  database.runTransaction(db, () => {
    const threadArgs = [
      thread.id,
      thread.workspaceRoot ?? "",
      thread.createdAt ?? 0,
      thread.updatedAt ?? 0,
      thread.title ?? "New Chat",
      thread.status ?? "idle",
      thread.latestOrchestration ? JSON.stringify(thread.latestOrchestration) : null,
      thread.branchInfo ? JSON.stringify(thread.branchInfo) : null
    ];
    insertThread.run(...threadArgs);
    insertThreadMessages(insertMsg, thread.id, msgs);
  });
  fs$2.renameSync(filePath, filePath + ".bak");
  return true;
}
function migrateThreadFiles(opts, jsonFiles) {
  const { db, insertThread, insertMsg, dir } = opts;
  let migrated = 0;
  for (const file of jsonFiles) {
    try {
      if (migrateOneThreadFile(db, insertThread, insertMsg, path$1.join(dir, file))) migrated++;
    } catch (err) {
      logger.log.warn(`Failed to migrate thread file ${file}:`, err);
    }
  }
  return migrated;
}
function migrateThreadStore(threadsDir) {
  const dir = path$1.join(electron.app.getPath("userData"), "agent-chat", "threads");
  if (!fs$2.existsSync(dir)) return;
  const jsonFiles = fs$2.readdirSync(dir).filter((f) => f.endsWith(".json"));
  if (jsonFiles.length === 0) return;
  let db = null;
  try {
    db = database.openDatabase(path$1.join(dir, "threads.db"));
    ensureThreadSchema(db);
    const insertThread = db.prepare(
      `INSERT OR IGNORE INTO threads (id, workspaceRoot, createdAt, updatedAt, title, status, latestOrchestration, branchInfo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMsg = db.prepare(
      `INSERT OR IGNORE INTO messages (id, threadId, role, content, createdAt, statusKind, orchestration, contextSummary, verificationPreview, error, toolsSummary, costSummary, durationSummary, tokenUsage, blocks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const migrated = migrateThreadFiles({ db, insertThread, insertMsg, dir }, jsonFiles);
    if (migrated > 0) logger.log.info(`Thread store: migrated ${migrated} threads`);
  } catch (err) {
    logger.log.warn("Thread store migration failed:", err);
  } finally {
    database.closeDatabase(db);
  }
}
function ensureCostSchema(db) {
  if (database.getSchemaVersion(db) >= 1) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL, session_id TEXT NOT NULL UNIQUE,
      task_label TEXT NOT NULL DEFAULT '', model TEXT NOT NULL DEFAULT '',
      input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL DEFAULT 0, timestamp INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cost_timestamp ON cost_entries(timestamp DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_session ON cost_entries(session_id);
  `);
  database.setSchemaVersion(db, 1);
}
function readCostEntries(jsonPath) {
  try {
    const data = JSON.parse(fs$2.readFileSync(jsonPath, "utf-8"));
    return Array.isArray(data.entries) ? data.entries : null;
  } catch {
    return null;
  }
}
const COST_INSERT_SQL = `INSERT OR IGNORE INTO cost_entries
  (date, session_id, task_label, model, input_tokens, output_tokens,
   cache_read_tokens, cache_write_tokens, estimated_cost, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
function insertCostEntries(db, entries) {
  const insert = db.prepare(COST_INSERT_SQL);
  database.runTransaction(db, () => {
    for (const e of entries) {
      insert.run(
        e.date,
        e.sessionId,
        e.taskLabel,
        e.model,
        e.inputTokens,
        e.outputTokens,
        e.cacheReadTokens,
        e.cacheWriteTokens,
        e.estimatedCost,
        e.timestamp
      );
    }
  });
}
function migrateCostHistory() {
  const jsonPath = path$1.join(electron.app.getPath("userData"), "cost-history.json");
  const bakPath = jsonPath + ".bak";
  if (!fs$2.existsSync(jsonPath) || fs$2.existsSync(bakPath)) return;
  const entries = readCostEntries(jsonPath);
  if (!entries) return;
  let db = null;
  try {
    db = database.openDatabase(path$1.join(electron.app.getPath("userData"), "cost-history.db"));
    ensureCostSchema(db);
    insertCostEntries(db, entries);
    fs$2.renameSync(jsonPath, bakPath);
    logger.log.info(`Cost history: migrated ${entries.length} entries`);
  } catch (err) {
    logger.log.warn("Cost history migration failed:", err);
  } finally {
    database.closeDatabase(db);
  }
}
function runAllMigrations(projectRoot) {
  logger.log.info("Running SQLite data migrations...");
  try {
    if (projectRoot) migrateGraphStore(projectRoot);
    migrateThreadStore();
    migrateCostHistory();
    logger.log.info("All migrations complete");
  } catch (err) {
    logger.log.warn("Migration runner encountered an error:", err);
  }
}
function isParityQueueEnabled() {
  const tel = database.getConfigValue("telemetry");
  return tel?.parityQueue?.enabled !== false;
}
async function runParityQueueDrain() {
  if (!isParityQueueEnabled()) return;
  try {
    const queueDir = getQueueDir();
    const cap = enforceTotalDirCap(queueDir);
    if (cap.dropped.length > 0) {
      logger.log.warn("[telemetry-queue] dropped over-cap files:", cap.dropped);
    }
    const summary = await drainQueue();
    if (summary.filesProcessed > 0) {
      logger.log.info("[telemetry-queue] drain summary", summary);
    }
  } catch (err) {
    logger.log.warn("[telemetry-queue] drain failed (non-fatal):", err);
  }
}
bootstrapProcessHandlers(writeCrashLog);
bootstrapCrashReporter();
bootstrapApp();
ensureSingleInstance();
let mainWindow = null;
function notifyStartupFailure(name, err) {
  const message = err instanceof Error ? err.message : String(err);
  for (const win of contextLayerController.getAllActiveWindows()) {
    if (!win.isDestroyed()) win.webContents.send("app:startupWarning", { name, message });
  }
}
async function runStartupStep(errorMessage, step, critical = false) {
  try {
    await step();
  } catch (err) {
    logger.log.error(errorMessage, err);
    if (critical) notifyStartupFailure(errorMessage, err);
  }
}
async function startIdeTools() {
  const addr = await contextLayerController.startIdeToolServer();
  if (addr) logger.log.info(`IDE tool server started at ${addr.address}`);
}
async function injectStandaloneMcpEntry() {
  if (!database.getConfigValue("internalMcpEnabled")) {
    logger.log.info("[internal-mcp] disabled by config (internalMcpEnabled=false) — skipping injection");
    return;
  }
  if (!database.getConfigValue("useMcpHost")) {
    logger.log.info("[internal-mcp] useMcpHost disabled — skipping injection");
    return;
  }
  const workspaceRoot = database.getConfigValue("defaultProjectRoot");
  if (!workspaceRoot) {
    logger.log.info("[internal-mcp] no project root — skipping injection");
    return;
  }
  const inject = buildInjectOptions(__dirname);
  await injectIntoProjectSettings(workspaceRoot, 0, inject);
  logger.log.info("[internal-mcp] injected standalone entry into <root>/.mcp.json");
}
async function startBackgroundServices(win) {
  await runStartupStep(
    "[main] failed to start hooks server:",
    async () => contextLayerController.startHooksServer(win),
    true
  );
  await runStartupStep("[main] failed to start IDE tool server:", startIdeTools);
  await runStartupStep("[main] failed to inject standalone MCP entry:", injectStandaloneMcpEntry);
  const root = database.getConfigValue("defaultProjectRoot");
  await runStartupStep(
    "[main] failed to enable user-level CodeMode:",
    () => enableCodeModeUserLevel({ projectRoot: root })
  );
  if (!root || contextLayerController.isWorkspaceTrusted(root)) {
    await runStartupStep("[main] hook installer error:", installHooks);
    await runStartupStep("[main] extensions init error:", contextLayerController.initExtensions);
  } else {
    logger.log.info("[main] Restricted mode — hooks/extensions disabled for untrusted workspace");
  }
  startClaudeUsagePoller();
}
function registerRenderProcessCrashLogging() {
  electron.app.on("render-process-gone", (_event, _webContents, details) => {
    const msg = `Reason: ${details.reason}
ExitCode: ${details.exitCode}`;
    logger.log.error("render-process-gone:", msg);
    void writeCrashLog("renderer:render-process-gone", msg);
  });
}
function focusLastWindow() {
  const windows = contextLayerController.getAllActiveWindows();
  if (windows.length === 0) return;
  const win = windows[windows.length - 1];
  if (win.isMinimized()) win.restore();
  win.focus();
}
function registerWindowLifecycleHandlers() {
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) mainWindow = contextLayerController.createWindow();
  });
  electron.app.on("second-instance", (_event, argv) => {
    focusLastWindow();
    dispatchPermalinkFromArgv(argv);
  });
}
function startContextLayerAsync(defaultRoot) {
  const contextLayerConfig = database.getConfigValue("contextLayer") ?? {
    enabled: true,
    maxModules: 50,
    maxSizeBytes: 200 * 1024,
    debounceMs: 5e3,
    autoSummarize: true
  };
  contextLayerController.initContextLayer({
    workspaceRoot: database.getConfigValue("defaultProjectRoot"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildRepoIndex: contextPacketBuilder.buildRepoIndexSnapshot,
    config: {
      ...contextLayerConfig,
      generateRepoMapFn: (opts) => getRepoMapWorkerClient().generateRepoMap(opts)
    }
  }).then(() => {
    logger.log.info("Initialization complete");
  }).catch((error) => {
    logger.log.warn("Initialization failed:", error);
  });
  initCodebaseGraph().catch((error) => {
    logger.log.error("Initialization failed:", error);
  });
  if (defaultRoot) {
    contextLayerController.loadPersistedContextCache();
    contextLayerController.startContextRefreshTimer([defaultRoot]);
  }
}
function startWebServerAsync() {
  const webPort = database.getConfigValue("webAccessPort") ?? 7890;
  const outMainDir = __dirname.endsWith("chunks") ? path$1.dirname(__dirname) : __dirname;
  const webStaticDir = path$1.join(outMainDir, "../web");
  contextLayerController.startWebServer({ port: webPort, staticDir: webStaticDir }).then(() => {
    contextLayerController.getOrCreateWebToken();
    logger.log.info(`Access URL: http://localhost:${webPort}`);
  }).catch((error) => {
    logger.log.error("Failed to start web server:", error);
  });
}
async function initTelemetryAndWriters(ud) {
  await runStartupStep("[main] telemetry store init", () => sessionStore.initTelemetryStore(ud));
  const store = sessionStore.getTelemetryStore();
  if (store) contextLayerController.initOutcomeObserver(store);
  contextPacketBuilder.initDecisionWriter(ud);
  contextPacketBuilder.initOutcomeWriter(ud);
  contextPacketBuilder.initResearchOutcomeWriter(ud);
  contextLayerController.initCorrectionWriter(ud);
  contextPacketBuilder.initEditProvenance(ud);
  scheduleJsonlRetentionPurge(ud);
  scheduleResearchCachePurge(ud);
  registerAllTelemetryDrainHandlers();
  await runParityQueueDrain();
  contextLayerController.startContextRetrainTriggerIfEnabled(ud);
}
async function initWindowsAndServices(defaultRoot) {
  contextLayerController.initializePerfMetrics({ getActiveWindows: contextLayerController.getAllActiveWindows });
  const restored = contextLayerController.restoreWindowSessions();
  mainWindow = restored[0] ?? contextLayerController.createWindow();
  buildApplicationMenu(mainWindow);
  await startBackgroundServices(mainWindow);
  try {
    contextLayerController.initClaudeMdGenerator();
  } catch (err) {
    logger.log.warn("Generator initialization failed:", err);
  }
  registerRenderProcessCrashLogging();
  initialiseCrashReporter();
  configureAutoUpdater();
  contextLayerController.startPerfMetrics();
  startJankDetector();
  contextLayerController.startTokenRefreshManager();
  registerWindowLifecycleHandlers();
  void seedGithubTokenWithRetry();
  startContextLayerAsync(defaultRoot);
  startWebServerAsync();
  loadRetrainedWeightsIfAvailable();
  observeDatasetGrowth();
}
async function initializeApplication() {
  contextLayerController.markStartup("app-ready");
  const defaultRoot = database.getConfigValue("defaultProjectRoot");
  runAllMigrations(defaultRoot);
  await contextLayerController.fireBootRestore(defaultRoot);
  const ud = electron.app.getPath("userData");
  await initTelemetryAndWriters(ud);
  await runStartupStep("[main] session services", () => initSessionServices());
  registerBuiltinProviders();
  await migrateSecretsIfNeeded();
  contextPacketBuilder.setTokenFilePath(ud);
  contextPacketBuilder.generatePipeTokens();
  contextLayerController.installHandlerCapture();
  await initWindowsAndServices(defaultRoot);
  contextLayerController.markStartup("services-ready");
}
setupThreadProtocol();
electron.app.whenReady().then(initializeApplication);
electron.app.on("window-all-closed", async () => {
  stopJankDetector();
  contextLayerController.stopTokenRefreshManager();
  contextLayerController.stopContextRefreshTimer();
  await contextLayerController.terminateContextWorker();
  contextLayerController.clearPerfSubscribers();
  contextLayerController.stopPerfMetrics();
  await contextLayerController.stopWebServer();
  await contextLayerController.stopHooksServer();
  await contextLayerController.stopIdeToolServer();
  contextLayerController.killAllPtySessions();
  contextLayerController.killAllWarm();
  if (process.platform !== "darwin") electron.app.quit();
});
let shutdownInProgress = false;
let shutdownComplete = false;
electron.app.on("will-quit", (event) => {
  if (shutdownComplete) return;
  event.preventDefault();
  if (shutdownInProgress) return;
  shutdownInProgress = true;
  void performWillQuitShutdown().catch((err) => logger.log.warn("[main] will-quit shutdown error:", err)).finally(() => {
    shutdownComplete = true;
    electron.app.quit();
  });
});
electron.app.on("web-contents-created", (_event, contents) => {
  contents.on("destroyed", () => {
    contextLayerController.cleanupPerfSubscriber(contents.id);
  });
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") return;
    if (process.env.NODE_ENV !== "development") {
      event.preventDefault();
      return;
    }
    const devOrigin = new URL(process.env["ELECTRON_RENDERER_URL"] ?? "http://localhost:5173").origin;
    if (parsed.origin !== devOrigin) event.preventDefault();
  });
});
