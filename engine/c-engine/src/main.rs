use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use tree_sitter::{Node, Parser as TsParser};

// - single file engine core
// - cli entry
// - request validation
// - token normalization
// - fingerprint ranking
// - gst evidence mapping
const SCHEMA_VERSION: &str = "1.0";
const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");
const FNV_OFFSET_BASIS: u64 = 0xcbf29ce484222325;
const FNV_PRIME: u64 = 0x100000001b3;
const KGRAM_BASE: u64 = 1_000_003;

// - top level cli shape
#[derive(Parser)]
#[command(name = "engine", version = ENGINE_VERSION, disable_help_subcommand = true)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

// - first cli layer
#[derive(Subcommand)]
enum Commands {
    #[command(subcommand)]
    Ccpp(CcppCommand),
}

// - engine actions
// - rank batch pairs
// - compare one pair
// - concat source files
#[derive(Subcommand)]
enum CcppCommand {
    Rank {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
    Compare {
        #[arg(long)]
        input: PathBuf,
        #[arg(long = "a-id")]
        a_id: String,
        #[arg(long = "b-id")]
        b_id: String,
        #[arg(long)]
        output: PathBuf,
    },
    Concat {
        #[arg(long)]
        input: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
}

// - error buckets
// - each bucket maps to a fixed exit code
#[derive(Debug)]
enum EngineError {
    InvalidRequest(String),
    UnsupportedLanguage(String),
    Internal(String),
}

impl EngineError {
    // - docx exit code mapping
    fn exit_code(&self) -> i32 {
        match self {
            EngineError::InvalidRequest(_) => 2,
            EngineError::UnsupportedLanguage(_) => 3,
            EngineError::Internal(_) => 4,
        }
    }
}

// - stderr uses only the message payload
impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EngineError::InvalidRequest(msg)
            | EngineError::UnsupportedLanguage(msg)
            | EngineError::Internal(msg) => write!(f, "{}", msg),
        }
    }
}

// - small main
// - print one line
// - exit with mapped code
fn main() {
    if let Err(err) = run() {
        eprintln!("{}", err);
        std::process::exit(err.exit_code());
    }
}

// - route cli command to worker
fn run() -> Result<(), EngineError> {
    let cli = Cli::try_parse()
        .map_err(|e| EngineError::InvalidRequest(first_line(&e.to_string())))?;

    match cli.command {
        Commands::Ccpp(cmd) => match cmd {
            CcppCommand::Rank { input, output } => {
                let req: AnalysisRequest = read_json(&input)?;
                let result = analyze_rank(req)?;
                write_json(&output, &result)
            }
            CcppCommand::Compare {
                input,
                a_id,
                b_id,
                output,
            } => {
                let req: AnalysisRequest = read_json(&input)?;
                let result = analyze_compare(req, &a_id, &b_id)?;
                write_json(&output, &result)
            }
            CcppCommand::Concat { input, output } => {
                let req: ConcatRequest = read_json(&input)?;
                let result = concat_sources(req)?;
                write_json(&output, &result)
            }
        },
    }
}

// - clap and serde errors can span many lines
// - keep stderr single line
fn first_line(message: &str) -> String {
    message.lines().next().unwrap_or("invalid arguments").to_string()
}

// - generic json reader for requests
fn read_json<T: for<'de> Deserialize<'de>>(path: &PathBuf) -> Result<T, EngineError> {
    let content = fs::read_to_string(path)
        .map_err(|e| EngineError::Internal(format!("failed to read input: {}", e)))?;
    serde_json::from_str(&content)
        .map_err(|e| EngineError::InvalidRequest(format!("invalid json: {}", first_line(&e.to_string()))))
}

// - pretty print outputs for stable test diffs
fn write_json<T: Serialize>(path: &PathBuf, value: &T) -> Result<(), EngineError> {
    let content = serde_json::to_string_pretty(value)
        .map_err(|e| EngineError::Internal(format!("failed to serialize output: {}", e)))?;
    fs::write(path, content)
        .map_err(|e| EngineError::Internal(format!("failed to write output: {}", e)))
}

// - request payload from rank and compare
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct AnalysisRequest {
    schema_version: String,
    engine_version: String,
    language: String,
    submissions: Vec<SubmissionInput>,
    #[serde(default)]
    template: Option<TemplateInput>,
    params: Params,
}

// - one student submission
#[derive(Debug, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
struct SubmissionInput {
    submission_id: String,
    source: String,
    #[serde(default)]
    source_map: Option<Vec<FileBoundary>>,
}

// - optional template payload
#[derive(Debug, Deserialize, Clone)]
#[serde(deny_unknown_fields)]
struct TemplateInput {
    source: String,
    #[serde(default)]
    source_map: Option<Vec<FileBoundary>>,
}

// - original file slice inside concatenated source
#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(deny_unknown_fields)]
struct FileBoundary {
    file_path: String,
    byte_start: usize,
    byte_end: usize,
}

// - runtime tuning knobs from request
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Params {
    k_gram: usize,
    window: usize,
    gst_min_match: usize,
    top_k: usize,
    #[serde(default)]
    threshold_primary: Option<f64>,
    #[serde(default)]
    options: Option<Options>,
}

// - parser and normalization switches
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct Options {
    #[serde(default)]
    ignore_comments: Option<bool>,
    #[serde(default)]
    ignore_pp_directives: Option<bool>,
    #[serde(default)]
    consistent_identifier_renaming: Option<bool>,
    #[serde(default)]
    anonymize_literals: Option<bool>,
}

// - result payload returned by rank and compare
#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
struct AnalysisResult {
    schema_version: String,
    engine_version: String,
    language: String,
    params_used: ParamsUsed,
    pairs: Vec<PairResult>,
}

// - resolved params
// - includes request defaults
#[derive(Debug, Serialize, Clone)]
#[serde(deny_unknown_fields)]
struct ParamsUsed {
    k_gram: usize,
    window: usize,
    gst_min_match: usize,
    top_k: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    threshold_primary: Option<f64>,
    options: OptionsUsed,
}

// - concrete option values after default fill
#[derive(Debug, Serialize, Clone)]
#[serde(deny_unknown_fields)]
struct OptionsUsed {
    ignore_comments: bool,
    ignore_pp_directives: bool,
    consistent_identifier_renaming: bool,
    anonymize_literals: bool,
}

// - one compared pair
#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
struct PairResult {
    a_id: String,
    b_id: String,
    score_primary: f64,
    score_secondary: f64,
    matches: Vec<MatchSpan>,
}

// - evidence span pair
#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
struct MatchSpan {
    a: LocationSpan,
    b: LocationSpan,
}

// - ui friendly span
// - byte range
// - line and column
// - optional file path
#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
struct LocationSpan {
    byte_start: usize,
    byte_end: usize,
    line_start: usize,
    col_start: usize,
    line_end: usize,
    col_end: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
}

// - concat helper request
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ConcatRequest {
    files: Vec<ConcatFile>,
}

// - one file for concat helper
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct ConcatFile {
    file_path: String,
    source: String,
}

// - concat helper output
#[derive(Debug, Serialize)]
#[serde(deny_unknown_fields)]
struct ConcatOutput {
    source: String,
    source_map: Vec<FileBoundary>,
}

// - parser choice
#[derive(Debug, Clone, Copy)]
enum LanguageKind {
    C,
    Cpp,
}

// - normalized submission cache
// - token stream
// - byte spans
// - line lookup
// - fingerprints after template subtraction
// - gst mask for template regions
#[derive(Debug)]
struct NormalizedProgram {
    submission_id: String,
    tokens: Vec<String>,
    spans: Vec<(usize, usize)>,
    line_index: LineIndex,
    source_map: Option<Vec<FileBoundary>>,
    fingerprint_set: HashSet<u64>,
    template_mask: Vec<bool>,
}

// - byte to line lookup table
#[derive(Debug, Clone)]
struct LineIndex {
    line_starts: Vec<usize>,
}

// - gst tile in token space
#[derive(Debug, Clone)]
struct Tile {
    a_start: usize,
    b_start: usize,
    len: usize,
}

// - full batch path
// - validate
// - normalize
// - rank
// - gst top pairs
fn analyze_rank(req: AnalysisRequest) -> Result<AnalysisResult, EngineError> {
    let validated = validate_request(&req, 2)?;
    let template_set = if let Some(template) = &req.template {
        Some(compute_template_fingerprints(template, validated.language, &validated.params)?)
    } else {
        None
    };

    let programs = build_programs(
        &req.submissions,
        validated.language,
        &validated.params,
        template_set.as_ref(),
    )?;

    let candidates = generate_candidates(&programs, &validated.params);
    let mut pairs = Vec::new();

    for candidate in candidates {
        let a = &programs[candidate.a_idx];
        let b = &programs[candidate.b_idx];
        let (matches, score_secondary) = compare_programs(a, b, validated.params.gst_min_match)?;
        pairs.push(PairResult {
            a_id: a.submission_id.clone(),
            b_id: b.submission_id.clone(),
            score_primary: candidate.score_primary,
            score_secondary,
            matches,
        });
    }

    Ok(AnalysisResult {
        schema_version: SCHEMA_VERSION.to_string(),
        engine_version: ENGINE_VERSION.to_string(),
        language: req.language,
        params_used: validated.params,
        pairs,
    })
}

// - single pair path
// - useful for focused ui drilldown and tests
fn analyze_compare(
    req: AnalysisRequest,
    a_id: &str,
    b_id: &str,
) -> Result<AnalysisResult, EngineError> {
    let validated = validate_request(&req, 2)?;
    if a_id == b_id {
        return Err(EngineError::InvalidRequest(
            "a_id and b_id must be different".to_string(),
        ));
    }

    let template_set = if let Some(template) = &req.template {
        Some(compute_template_fingerprints(template, validated.language, &validated.params)?)
    } else {
        None
    };

    let mut a_sub = None;
    let mut b_sub = None;
    for sub in &req.submissions {
        if sub.submission_id == a_id {
            if a_sub.is_some() {
                return Err(EngineError::InvalidRequest(
                    "duplicate submission_id for a_id".to_string(),
                ));
            }
            a_sub = Some(sub.clone());
        }
        if sub.submission_id == b_id {
            if b_sub.is_some() {
                return Err(EngineError::InvalidRequest(
                    "duplicate submission_id for b_id".to_string(),
                ));
            }
            b_sub = Some(sub.clone());
        }
    }

    let a_sub = a_sub.ok_or_else(|| {
        EngineError::InvalidRequest("a_id not found in submissions".to_string())
    })?;
    let b_sub = b_sub.ok_or_else(|| {
        EngineError::InvalidRequest("b_id not found in submissions".to_string())
    })?;

    let programs = build_programs(
        &[a_sub, b_sub],
        validated.language,
        &validated.params,
        template_set.as_ref(),
    )?;

    let a = &programs[0];
    let b = &programs[1];
    let score_primary = jaccard(&a.fingerprint_set, &b.fingerprint_set, None);
    let (matches, score_secondary) = compare_programs(a, b, validated.params.gst_min_match)?;

    let pairs = vec![PairResult {
        a_id: a.submission_id.clone(),
        b_id: b.submission_id.clone(),
        score_primary,
        score_secondary,
        matches,
    }];

    Ok(AnalysisResult {
        schema_version: SCHEMA_VERSION.to_string(),
        engine_version: ENGINE_VERSION.to_string(),
        language: req.language,
        params_used: validated.params,
        pairs,
    })
}

// - concat helper
// - preserve file order
// - force trailing newline per file
// - emit byte boundaries
fn concat_sources(req: ConcatRequest) -> Result<ConcatOutput, EngineError> {
    if req.files.is_empty() {
        return Err(EngineError::InvalidRequest(
            "concat requires at least one file".to_string(),
        ));
    }

    let mut source = String::new();
    let mut source_map = Vec::new();

    for file in req.files {
        if file.file_path.trim().is_empty() {
            return Err(EngineError::InvalidRequest(
                "file_path must be non-empty".to_string(),
            ));
        }
        let start = source.as_bytes().len();
        let mut content = file.source;
        if !content.ends_with('\n') {
            content.push('\n');
        }
        source.push_str(&content);
        let end = source.as_bytes().len();
        source_map.push(FileBoundary {
            file_path: file.file_path,
            byte_start: start,
            byte_end: end,
        });
    }

    Ok(ConcatOutput { source, source_map })
}

// - validated request state reused by workers
struct ValidatedRequest {
    language: LanguageKind,
    params: ParamsUsed,
}

// - request level guards
// - schema version
// - ids
// - source maps
// - param ranges
// - forced normalization flags
fn validate_request(req: &AnalysisRequest, min_submissions: usize) -> Result<ValidatedRequest, EngineError> {
    if req.schema_version != SCHEMA_VERSION {
        return Err(EngineError::InvalidRequest(
            "schema_version must be 1.0".to_string(),
        ));
    }
    if req.engine_version.trim().is_empty() {
        return Err(EngineError::InvalidRequest(
            "engine_version must be non-empty".to_string(),
        ));
    }

    let language = parse_language(&req.language)?;

    if req.submissions.len() < min_submissions {
        return Err(EngineError::InvalidRequest(
            "submissions must contain at least two items".to_string(),
        ));
    }

    let mut seen_ids = HashSet::new();
    for sub in &req.submissions {
        if sub.submission_id.trim().is_empty() {
            return Err(EngineError::InvalidRequest(
                "submission_id must be non-empty".to_string(),
            ));
        }
        if !seen_ids.insert(sub.submission_id.as_str()) {
            return Err(EngineError::InvalidRequest(
                "submission_id values must be unique".to_string(),
            ));
        }
        if let Some(map) = &sub.source_map {
            validate_source_map(&sub.source, map)?;
        }
    }

    if let Some(template) = &req.template {
        if let Some(map) = &template.source_map {
            validate_source_map(&template.source, map)?;
        }
    }

    let params = &req.params;
    if params.k_gram < 1
        || params.window < 1
        || params.gst_min_match < 1
        || params.top_k < 1
    {
        return Err(EngineError::InvalidRequest(
            "k_gram, window, gst_min_match, and top_k must be >= 1".to_string(),
        ));
    }

    if let Some(threshold) = params.threshold_primary {
        if !(0.0..=1.0).contains(&threshold) {
            return Err(EngineError::InvalidRequest(
                "threshold_primary must be in [0.0, 1.0]".to_string(),
            ));
        }
    }

    let opts = params.options.as_ref();
    let ignore_comments = opts.and_then(|o| o.ignore_comments).unwrap_or(true);
    let ignore_pp_directives = opts
        .and_then(|o| o.ignore_pp_directives)
        .unwrap_or(true);
    let consistent_identifier_renaming = opts
        .and_then(|o| o.consistent_identifier_renaming)
        .unwrap_or(true);
    let anonymize_literals = opts.and_then(|o| o.anonymize_literals).unwrap_or(true);

    if !consistent_identifier_renaming {
        return Err(EngineError::InvalidRequest(
            "consistent_identifier_renaming must be true".to_string(),
        ));
    }
    if !anonymize_literals {
        return Err(EngineError::InvalidRequest(
            "anonymize_literals must be true".to_string(),
        ));
    }

    let params_used = ParamsUsed {
        k_gram: params.k_gram,
        window: params.window,
        gst_min_match: params.gst_min_match,
        top_k: params.top_k,
        threshold_primary: params.threshold_primary,
        options: OptionsUsed {
            ignore_comments,
            ignore_pp_directives,
            consistent_identifier_renaming,
            anonymize_literals,
        },
    };

    Ok(ValidatedRequest { language, params: params_used })
}

// - parse string language into internal enum
fn parse_language(language: &str) -> Result<LanguageKind, EngineError> {
    match language {
        "c" => Ok(LanguageKind::C),
        "cpp" => Ok(LanguageKind::Cpp),
        other => Err(EngineError::UnsupportedLanguage(format!(
            "unsupported language: {}",
            other
        ))),
    }
}

// - source map guards
// - non empty
// - in bounds
// - non overlapping
fn validate_source_map(source: &str, map: &Vec<FileBoundary>) -> Result<(), EngineError> {
    if map.is_empty() {
        return Err(EngineError::InvalidRequest(
            "source_map must contain at least one entry".to_string(),
        ));
    }

    let source_len = source.as_bytes().len();
    let mut ranges: Vec<(usize, usize)> = Vec::with_capacity(map.len());

    for entry in map {
        if entry.byte_end < entry.byte_start {
            return Err(EngineError::InvalidRequest(
                "source_map byte_end must be >= byte_start".to_string(),
            ));
        }
        if entry.byte_end > source_len {
            return Err(EngineError::InvalidRequest(
                "source_map byte_end exceeds source length".to_string(),
            ));
        }
        ranges.push((entry.byte_start, entry.byte_end));
    }

    ranges.sort_by_key(|(start, _)| *start);
    for idx in 0..ranges.len().saturating_sub(1) {
        let (prev_start, prev_end) = ranges[idx];
        let (next_start, _) = ranges[idx + 1];
        if next_start < prev_end {
            return Err(EngineError::InvalidRequest(
                "source_map ranges must not overlap".to_string(),
            ));
        }
        if prev_start > prev_end {
            return Err(EngineError::InvalidRequest(
                "source_map byte_end must be >= byte_start".to_string(),
            ));
        }
    }

    Ok(())
}

// - template uses same normalization and fingerprint path as submissions
fn compute_template_fingerprints(
    template: &TemplateInput,
    language: LanguageKind,
    params: &ParamsUsed,
) -> Result<HashSet<u64>, EngineError> {
    let normalized = tokenize_and_normalize(&template.source, language, &params.options)?;
    let fingerprints = build_fingerprints(&normalized.tokens, params.k_gram, params.window);
    Ok(fingerprints.set)
}

// - submission preprocessing cache
// - normalize tokens
// - fingerprint tokens
// - subtract template hashes
// - build gst template mask
fn build_programs(
    submissions: &[SubmissionInput],
    language: LanguageKind,
    params: &ParamsUsed,
    template_set: Option<&HashSet<u64>>,
) -> Result<Vec<NormalizedProgram>, EngineError> {
    let mut programs = Vec::with_capacity(submissions.len());

    for sub in submissions {
        let normalized = tokenize_and_normalize(&sub.source, language, &params.options)?;
        let fingerprints = build_fingerprints(&normalized.tokens, params.k_gram, params.window);

        let mut template_mask = vec![false; normalized.tokens.len()];
        if let Some(template_set) = template_set {
            apply_template_mask(
                &mut template_mask,
                &fingerprints.winnowed,
                template_set,
                params.k_gram,
            );
        }

        let mut fingerprint_set = fingerprints.set;
        if let Some(template_set) = template_set {
            for hash in template_set {
                fingerprint_set.remove(hash);
            }
        }

        programs.push(NormalizedProgram {
            submission_id: sub.submission_id.clone(),
            tokens: normalized.tokens,
            spans: normalized.spans,
            line_index: normalized.line_index,
            source_map: sub.source_map.clone(),
            fingerprint_set,
            template_mask,
        });
    }

    Ok(programs)
}

// - raw and unique fingerprint views
struct Fingerprints {
    winnowed: Vec<(u64, usize)>,
    set: HashSet<u64>,
}

// - hash tokens
// - build k grams
// - winnow into stable fingerprints
fn build_fingerprints(tokens: &[String], k_gram: usize, window: usize) -> Fingerprints {
    let token_hashes: Vec<u64> = tokens
        .iter()
        .map(|token| fnv1a64(token.as_bytes()))
        .collect();

    let kgrams = kgram_hashes(&token_hashes, k_gram);
    let winnowed = winnow(&kgrams, window);
    let set = winnowed.iter().map(|(hash, _)| *hash).collect();

    Fingerprints { winnowed, set }
}

// - deterministic token hash
// - fnv one a sixty four bit
fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash = FNV_OFFSET_BASIS;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    hash
}

// - rolling polynomial hash over token hashes
fn kgram_hashes(token_hashes: &[u64], k: usize) -> Vec<(u64, usize)> {
    if k == 0 || token_hashes.len() < k {
        return Vec::new();
    }

    let mut base_pow = 1u64;
    for _ in 1..k {
        base_pow = base_pow.wrapping_mul(KGRAM_BASE);
    }

    let mut hashes = Vec::with_capacity(token_hashes.len() - k + 1);
    let mut hash = 0u64;

    for i in 0..k {
        hash = hash.wrapping_mul(KGRAM_BASE).wrapping_add(token_hashes[i]);
    }
    hashes.push((hash, 0));

    for i in 1..=token_hashes.len() - k {
        let outgoing = token_hashes[i - 1];
        let incoming = token_hashes[i + k - 1];
        hash = hash.wrapping_sub(outgoing.wrapping_mul(base_pow));
        hash = hash.wrapping_mul(KGRAM_BASE).wrapping_add(incoming);
        hashes.push((hash, i));
    }

    hashes
}

// - winnowing with rightmost minimum tie break
fn winnow(kgrams: &[(u64, usize)], window: usize) -> Vec<(u64, usize)> {
    if kgrams.is_empty() {
        return Vec::new();
    }

    let window = window.min(kgrams.len());
    let mut fingerprints = Vec::new();
    let mut last_selected: Option<(u64, usize)> = None;

    for start in 0..=kgrams.len() - window {
        let mut min = kgrams[start];
        for idx in start..start + window {
            let candidate = kgrams[idx];
            if candidate.0 < min.0 || (candidate.0 == min.0 && candidate.1 > min.1) {
                min = candidate;
            }
        }

        if last_selected.map_or(true, |prev| prev != min) {
            fingerprints.push(min);
            last_selected = Some(min);
        }
    }

    fingerprints
}

// - approximate template regions for gst masking
fn apply_template_mask(
    mask: &mut [bool],
    fingerprints: &[(u64, usize)],
    template_set: &HashSet<u64>,
    k: usize,
) {
    if k == 0 {
        return;
    }

    for (hash, start) in fingerprints {
        if template_set.contains(hash) {
            let end = (*start + k).min(mask.len());
            for idx in *start..end {
                mask[idx] = true;
            }
        }
    }
}

// - inverted index candidate generation
// - only score pairs sharing at least one fingerprint
// - stable sort by score then ids
fn generate_candidates(programs: &[NormalizedProgram], params: &ParamsUsed) -> Vec<PairCandidate> {
    let mut index: HashMap<u64, Vec<usize>> = HashMap::new();
    for (idx, program) in programs.iter().enumerate() {
        for hash in &program.fingerprint_set {
            index.entry(*hash).or_default().push(idx);
        }
    }

    let mut overlaps: HashMap<(usize, usize), usize> = HashMap::new();
    for postings in index.values() {
        let mut entries = postings.clone();
        entries.sort();
        entries.dedup();
        for i in 0..entries.len() {
            for j in i + 1..entries.len() {
                let key = (entries[i], entries[j]);
                *overlaps.entry(key).or_insert(0) += 1;
            }
        }
    }

    let mut candidates = Vec::new();
    for ((a_idx, b_idx), overlap) in overlaps {
        let a_set = &programs[a_idx].fingerprint_set;
        let b_set = &programs[b_idx].fingerprint_set;
        let score_primary = jaccard(a_set, b_set, Some(overlap));
        if let Some(threshold) = params.threshold_primary {
            if score_primary < threshold {
                continue;
            }
        }
        candidates.push(PairCandidate {
            a_idx,
            b_idx,
            score_primary,
        });
    }

    candidates.sort_by(|left, right| {
        right
            .score_primary
            .partial_cmp(&left.score_primary)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| {
                let a_left = &programs[left.a_idx].submission_id;
                let b_left = &programs[left.b_idx].submission_id;
                let a_right = &programs[right.a_idx].submission_id;
                let b_right = &programs[right.b_idx].submission_id;
                (a_left, b_left).cmp(&(a_right, b_right))
            })
    });

    if candidates.len() > params.top_k {
        candidates.truncate(params.top_k);
    }

    candidates
}

// - pair selected by primary scoring
struct PairCandidate {
    a_idx: usize,
    b_idx: usize,
    score_primary: f64,
}

// - set overlap score
fn jaccard(a: &HashSet<u64>, b: &HashSet<u64>, overlap: Option<usize>) -> f64 {
    if a.is_empty() && b.is_empty() {
        return 0.0;
    }

    let intersection = overlap.unwrap_or_else(|| {
        if a.len() <= b.len() {
            a.iter().filter(|hash| b.contains(hash)).count()
        } else {
            b.iter().filter(|hash| a.contains(hash)).count()
        }
    });

    let union = a.len() + b.len() - intersection;
    if union == 0 {
        0.0
    } else {
        intersection as f64 / union as f64
    }
}

// - secondary comparison path
// - run gst
// - map tiles to spans
// - compute symmetric coverage score
fn compare_programs(
    a: &NormalizedProgram,
    b: &NormalizedProgram,
    gst_min_match: usize,
) -> Result<(Vec<MatchSpan>, f64), EngineError> {
    let tiles = gst(
        &a.tokens,
        &b.tokens,
        gst_min_match,
        &a.template_mask,
        &b.template_mask,
    );

    let mut matches = Vec::new();
    let mut matched_tokens = 0usize;

    for tile in &tiles {
        matched_tokens += tile.len;
        let a_span = tile_to_location(tile.a_start, tile.len, a);
        let b_span = tile_to_location(tile.b_start, tile.len, b);
        matches.push(MatchSpan { a: a_span, b: b_span });
    }

    let total = a.tokens.len() + b.tokens.len();
    let score_secondary = if total == 0 {
        0.0
    } else {
        (2.0 * matched_tokens as f64) / total as f64
    };

    Ok((matches, score_secondary))
}

// - simple greedy string tiling
// - skip masked tokens
// - keep longest matches each round
fn gst(
    a_tokens: &[String],
    b_tokens: &[String],
    min_match: usize,
    a_mask: &[bool],
    b_mask: &[bool],
) -> Vec<Tile> {
    let mut marked_a = a_mask.to_vec();
    let mut marked_b = b_mask.to_vec();
    let mut tiles = Vec::new();

    loop {
        let mut max_len = min_match;
        let mut round_matches: Vec<Tile> = Vec::new();

        for i in 0..a_tokens.len() {
            if marked_a[i] {
                continue;
            }
            for j in 0..b_tokens.len() {
                if marked_b[j] {
                    continue;
                }
                if a_tokens[i] != b_tokens[j] {
                    continue;
                }

                let mut len = 0usize;
                while i + len < a_tokens.len()
                    && j + len < b_tokens.len()
                    && !marked_a[i + len]
                    && !marked_b[j + len]
                    && a_tokens[i + len] == b_tokens[j + len]
                {
                    len += 1;
                }

                if len >= max_len {
                    if len > max_len {
                        max_len = len;
                        round_matches.clear();
                    }
                    round_matches.push(Tile {
                        a_start: i,
                        b_start: j,
                        len,
                    });
                }
            }
        }

        if round_matches.is_empty() {
            break;
        }

        round_matches.sort_by(|left, right| {
            (left.a_start, left.b_start, left.len)
                .cmp(&(right.a_start, right.b_start, right.len))
        });

        for tile in round_matches {
            for offset in 0..tile.len {
                marked_a[tile.a_start + offset] = true;
                marked_b[tile.b_start + offset] = true;
            }
            tiles.push(tile);
        }
    }

    tiles.sort_by(|left, right| {
        (left.a_start, left.b_start, left.len).cmp(&(right.a_start, right.b_start, right.len))
    });

    tiles
}

// - convert token tile into ui span
// - start and end bytes come from token boundaries
// - file path comes from source map containment
fn tile_to_location(start: usize, len: usize, program: &NormalizedProgram) -> LocationSpan {
    let span_start = program.spans[start].0;
    let span_end = program.spans[start + len - 1].1;
    let (line_start, col_start) = program.line_index.line_col(span_start);
    let end_offset = if span_end > span_start {
        span_end - 1
    } else {
        span_start
    };
    let (line_end, col_end) = program.line_index.line_col(end_offset);

    let file_path = program
        .source_map
        .as_ref()
        .and_then(|map| file_path_for_span(map, span_start, span_end));

    LocationSpan {
        byte_start: span_start,
        byte_end: span_end,
        line_start,
        col_start,
        line_end,
        col_end,
        file_path,
    }
}

// - find original file owning a byte span
fn file_path_for_span(
    map: &Vec<FileBoundary>,
    byte_start: usize,
    byte_end: usize,
) -> Option<String> {
    for entry in map {
        if byte_start >= entry.byte_start && byte_end <= entry.byte_end {
            return Some(entry.file_path.clone());
        }
    }
    None
}

// - temporary result from parser and normalizer
struct NormalizedTokens {
    tokens: Vec<String>,
    spans: Vec<(usize, usize)>,
    line_index: LineIndex,
}

// - parse source with tree sitter
// - walk leaves
// - normalize identifiers and literals
fn tokenize_and_normalize(
    source: &str,
    language: LanguageKind,
    options: &OptionsUsed,
) -> Result<NormalizedTokens, EngineError> {
    let mut parser = TsParser::new();
    let ts_language = match language {
        LanguageKind::C => tree_sitter_c::language(),
        LanguageKind::Cpp => tree_sitter_cpp::language(),
    };
    parser
        .set_language(ts_language)
        .map_err(|_| EngineError::UnsupportedLanguage("parser init failed".to_string()))?;
    let tree = parser
        .parse(source, None)
        .ok_or_else(|| EngineError::Internal("parser failed to produce a syntax tree".to_string()))?;

    let mut tokens = Vec::new();
    let mut spans = Vec::new();
    let mut id_map: HashMap<String, String> = HashMap::new();
    let mut next_id = 1usize;

    collect_tokens(
        tree.root_node(),
        source,
        options,
        &mut id_map,
        &mut next_id,
        &mut tokens,
        &mut spans,
    );

    Ok(NormalizedTokens {
        tokens,
        spans,
        line_index: LineIndex::new(source),
    })
}

// - depth first leaf collection in source order
// - comments and preproc nodes can be skipped
fn collect_tokens(
    node: Node,
    source: &str,
    options: &OptionsUsed,
    id_map: &mut HashMap<String, String>,
    next_id: &mut usize,
    tokens: &mut Vec<String>,
    spans: &mut Vec<(usize, usize)>,
) {
    let kind = node.kind();
    if should_skip_node(kind, options) {
        return;
    }

    if node.child_count() == 0 {
        let start = node.start_byte();
        let end = node.end_byte();
        let text_bytes = &source.as_bytes()[start..end];
        let text = std::str::from_utf8(text_bytes).unwrap_or("");
        let normalized = normalize_token(kind, text, id_map, next_id);
        tokens.push(normalized);
        spans.push((start, end));
        return;
    }

    for idx in 0..node.child_count() {
        if let Some(child) = node.child(idx) {
            collect_tokens(child, source, options, id_map, next_id, tokens, spans);
        }
    }
}

// - comment and preproc filtering
fn should_skip_node(kind: &str, options: &OptionsUsed) -> bool {
    if options.ignore_comments && kind.contains("comment") {
        return true;
    }
    if options.ignore_pp_directives && kind.starts_with("preproc_") {
        return true;
    }
    false
}

// - identifier renaming is per submission
// - literals collapse into coarse buckets
// - other nodes use kind name
fn normalize_token(
    kind: &str,
    text: &str,
    id_map: &mut HashMap<String, String>,
    next_id: &mut usize,
) -> String {
    if is_identifier(kind) {
        if let Some(existing) = id_map.get(text) {
            return existing.clone();
        }
        let renamed = format!("ID{}", *next_id);
        *next_id += 1;
        id_map.insert(text.to_string(), renamed.clone());
        return renamed;
    }

    if kind == "number_literal" {
        return number_literal_kind(text).to_string();
    }

    if kind == "string_literal" {
        return "STR_LIT".to_string();
    }

    if kind == "char_literal" || kind == "character_literal" {
        return "CHAR_LIT".to_string();
    }

    kind.to_string()
}

// - tree sitter identifier match rules from spec
fn is_identifier(kind: &str) -> bool {
    kind == "identifier" || kind.ends_with("_identifier")
}

// - float detection from common literal markers
fn number_literal_kind(text: &str) -> &'static str {
    let lower = text.to_ascii_lowercase();
    if lower.contains('.') || lower.contains('e') || lower.contains('p') {
        "FLOAT_LIT"
    } else {
        "INT_LIT"
    }
}

impl LineIndex {
    // - line starts for binary search lookup
    fn new(source: &str) -> Self {
        let mut line_starts = Vec::new();
        line_starts.push(0);
        for (idx, byte) in source.as_bytes().iter().enumerate() {
            if *byte == b'\n' {
                line_starts.push(idx + 1);
            }
        }
        LineIndex { line_starts }
    }

    // - convert byte offset to one based line and column
    fn line_col(&self, byte_offset: usize) -> (usize, usize) {
        let pos = match self.line_starts.binary_search(&byte_offset) {
            Ok(idx) => idx,
            Err(idx) => idx.saturating_sub(1),
        };
        let line_start = self.line_starts[pos];
        (pos + 1, byte_offset - line_start + 1)
    }
}
