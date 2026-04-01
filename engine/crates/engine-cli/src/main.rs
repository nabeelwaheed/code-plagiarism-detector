use engine_contracts::AnalysisRequest;
use engine_core::analyze;
use std::io::{self, Read};

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .map_err(|error| format!("failed to read stdin: {error}"))?;

    let request: AnalysisRequest =
        serde_json::from_str(&input).map_err(|error| format!("invalid engine request: {error}"))?;
    let response = analyze(request)?;
    let output =
        serde_json::to_string_pretty(&response).map_err(|error| format!("failed to serialize response: {error}"))?;

    println!("{output}");
    Ok(())
}
