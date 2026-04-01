#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Tile {
    pub left_start: usize,
    pub right_start: usize,
    pub length: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GstResult {
    pub tiles: Vec<Tile>,
    pub matched_token_count: usize,
}

pub fn run_gst(
    left_tokens: &[String],
    right_tokens: &[String],
    left_mask: &[bool],
    right_mask: &[bool],
    min_match_length: usize,
) -> GstResult {
    let mut marked_left = left_mask.to_vec();
    let mut marked_right = right_mask.to_vec();
    let mut accepted_tiles = Vec::new();

    loop {
        let mut longest = min_match_length;
        let mut round_tiles = Vec::new();

        for left_start in 0..left_tokens.len() {
            if marked_left[left_start] {
                continue;
            }

            for right_start in 0..right_tokens.len() {
                if marked_right[right_start] {
                    continue;
                }

                let mut length = 0usize;
                while left_start + length < left_tokens.len()
                    && right_start + length < right_tokens.len()
                    && !marked_left[left_start + length]
                    && !marked_right[right_start + length]
                    && left_tokens[left_start + length] == right_tokens[right_start + length]
                {
                    length += 1;
                }

                if length >= longest {
                    if length > longest {
                        longest = length;
                        round_tiles.clear();
                    }

                    round_tiles.push(Tile {
                        left_start,
                        right_start,
                        length,
                    });
                }
            }
        }

        if round_tiles.is_empty() {
            break;
        }

        round_tiles.sort_by(|a, b| {
            (a.left_start, a.right_start, a.length).cmp(&(b.left_start, b.right_start, b.length))
        });

        for tile in round_tiles {
            if overlaps_marked(&tile, &marked_left, &marked_right) {
                continue;
            }

            for offset in 0..tile.length {
                marked_left[tile.left_start + offset] = true;
                marked_right[tile.right_start + offset] = true;
            }

            accepted_tiles.push(tile);
        }
    }

    let matched_token_count = accepted_tiles.iter().map(|tile| tile.length).sum();

    GstResult {
        tiles: accepted_tiles,
        matched_token_count,
    }
}

fn overlaps_marked(tile: &Tile, left: &[bool], right: &[bool]) -> bool {
    (0..tile.length).any(|offset| left[tile.left_start + offset] || right[tile.right_start + offset])
}

pub fn symmetric_coverage_score(matched_token_count: usize, left_len: usize, right_len: usize) -> f64 {
    let total = left_len + right_len;
    if total == 0 {
        0.0
    } else {
        (2.0 * matched_token_count as f64) / total as f64
    }
}

