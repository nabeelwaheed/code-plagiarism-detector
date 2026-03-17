use crate::part5_match_mapping::match_mapping_types::{
    CommentMatch, GenericCodeToken, GenericCommentToken, MappedCodeMatch,
    MappedCommentMatch, MatchMappingResult, MatchedTile,
};

pub fn map_all_matches(
    code_token_array_a: &[GenericCodeToken],
    code_token_array_b: &[GenericCodeToken],
    matched_tiles: &[MatchedTile],
    comment_token_array_a: &[GenericCommentToken],
    comment_token_array_b: &[GenericCommentToken],
    comment_matches: &[CommentMatch],
) -> Result<MatchMappingResult, String> {
    let mapped_code_matches =
        map_gst_tiles_to_source_ranges(code_token_array_a, code_token_array_b, matched_tiles)?;
    let mapped_comment_matches = map_comment_matches_to_source_ranges(
        comment_token_array_a,
        comment_token_array_b,
        comment_matches,
    )?;

    Ok(MatchMappingResult {
        mapped_code_matches,
        mapped_comment_matches,
    })
}

pub fn map_gst_tiles_to_source_ranges(
    code_token_array_a: &[GenericCodeToken],
    code_token_array_b: &[GenericCodeToken],
    matched_tiles: &[MatchedTile],
) -> Result<Vec<MappedCodeMatch>, String> {
    let mut mapped_code_matches = Vec::new();

    for tile in matched_tiles {
        let mapped_match =
            map_single_gst_tile_to_source_ranges(code_token_array_a, code_token_array_b, tile)?;
        mapped_code_matches.push(mapped_match);
    }

    Ok(mapped_code_matches)
}

pub fn map_single_gst_tile_to_source_ranges(
    code_token_array_a: &[GenericCodeToken],
    code_token_array_b: &[GenericCodeToken],
    matched_tile: &MatchedTile,
) -> Result<MappedCodeMatch, String> {
    if matched_tile.length == 0 {
        return Err("Matched tile length cannot be 0".to_string());
    }

    let start_token_index_a = matched_tile.start_index_a;
    let end_token_index_a = matched_tile.start_index_a + matched_tile.length - 1;

    let start_token_index_b = matched_tile.start_index_b;
    let end_token_index_b = matched_tile.start_index_b + matched_tile.length - 1;

    let start_token_a = code_token_array_a
        .get(start_token_index_a)
        .ok_or_else(|| "Invalid GST tile start index for sequence A".to_string())?;

    let end_token_a = code_token_array_a
        .get(end_token_index_a)
        .ok_or_else(|| "Invalid GST tile end index for sequence A".to_string())?;

    let start_token_b = code_token_array_b
        .get(start_token_index_b)
        .ok_or_else(|| "Invalid GST tile start index for sequence B".to_string())?;

    let end_token_b = code_token_array_b
        .get(end_token_index_b)
        .ok_or_else(|| "Invalid GST tile end index for sequence B".to_string())?;

    Ok(MappedCodeMatch {
        start_token_index_a,
        end_token_index_a,
        start_token_index_b,
        end_token_index_b,
        byte_start_a: start_token_a.byte_start,
        byte_end_a: end_token_a.byte_end,
        byte_start_b: start_token_b.byte_start,
        byte_end_b: end_token_b.byte_end,
        matched_length: matched_tile.length,
    })
}

pub fn map_comment_matches_to_source_ranges(
    comment_token_array_a: &[GenericCommentToken],
    comment_token_array_b: &[GenericCommentToken],
    comment_matches: &[CommentMatch],
) -> Result<Vec<MappedCommentMatch>, String> {
    let mut mapped_comment_matches = Vec::new();

    for comment_match in comment_matches {
        let mapped_match = map_single_comment_match_to_source_ranges(
            comment_token_array_a,
            comment_token_array_b,
            comment_match,
        )?;
        mapped_comment_matches.push(mapped_match);
    }

    Ok(mapped_comment_matches)
}

pub fn map_single_comment_match_to_source_ranges(
    comment_token_array_a: &[GenericCommentToken],
    comment_token_array_b: &[GenericCommentToken],
    comment_match: &CommentMatch,
) -> Result<MappedCommentMatch, String> {
    let comment_token_a = comment_token_array_a
        .get(comment_match.comment_index_a)
        .ok_or_else(|| "Invalid comment match index for sequence A".to_string())?;

    let comment_token_b = comment_token_array_b
        .get(comment_match.comment_index_b)
        .ok_or_else(|| "Invalid comment match index for sequence B".to_string())?;

    Ok(MappedCommentMatch {
        comment_index_a: comment_match.comment_index_a,
        comment_index_b: comment_match.comment_index_b,
        byte_start_a: comment_token_a.byte_start,
        byte_end_a: comment_token_a.byte_end,
        byte_start_b: comment_token_b.byte_start,
        byte_end_b: comment_token_b.byte_end,
        matched_text_a: comment_match.matched_text_a.clone(),
        matched_text_b: comment_match.matched_text_b.clone(),
        matched_length: comment_match.matched_length,
    })
}