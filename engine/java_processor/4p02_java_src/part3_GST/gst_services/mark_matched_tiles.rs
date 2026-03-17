use crate::part3_GST::gst_types::MatchedTile;

pub fn mark_matched_tiles(
    candidate_tiles: &[MatchedTile],
    marked_tokens_a: &mut [bool],
    marked_tokens_b: &mut [bool],
) -> Vec<MatchedTile> {
    let mut accepted_tiles = Vec::new();

    let mut sorted_tiles = candidate_tiles.to_vec();
    sorted_tiles.sort_by_key(|tile| (tile.start_index_a, tile.start_index_b));

    for tile in sorted_tiles {
        if tile_overlaps_with_marked_regions(&tile, marked_tokens_a, marked_tokens_b) {
            continue;
        }

        mark_tile_tokens(&tile, marked_tokens_a, marked_tokens_b);
        accepted_tiles.push(tile);
    }

    accepted_tiles
}

fn tile_overlaps_with_marked_regions(
    tile: &MatchedTile,
    marked_tokens_a: &[bool],
    marked_tokens_b: &[bool],
) -> bool {
    for offset in 0..tile.length {
        let index_a = tile.start_index_a + offset;
        let index_b = tile.start_index_b + offset;

        if marked_tokens_a[index_a] || marked_tokens_b[index_b] {
            return true;
        }
    }

    false
}

fn mark_tile_tokens(
    tile: &MatchedTile,
    marked_tokens_a: &mut [bool],
    marked_tokens_b: &mut [bool],
) {
    for offset in 0..tile.length {
        let index_a = tile.start_index_a + offset;
        let index_b = tile.start_index_b + offset;

        marked_tokens_a[index_a] = true;
        marked_tokens_b[index_b] = true;
    }
}