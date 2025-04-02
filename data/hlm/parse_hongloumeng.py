import re
import json
import os
import copy # For deep copying the schema

# --- Standard Schema Definition ---
# Defines all possible fields for EVERY entry in the output JSON.
DEFAULT_SCHEMA = {
    "page_number": None,
    "url": None,
    "content_type": "unknown", # Default type if parsing fails
    "details": {
        "title": None,
        "chapter": None,
        "collection_title": None,
        "painting_description": None,
        "poem_text": [], # Always initialize as list
        "text": None, # For general commentary body / main content block
        "explanation": None,
        "annotations": None,
        "appreciation": None,
        "commentary": None, # Consolidated from 评说/简释
        "additional_notes_title": None,
        "additional_notes_text": None,
        "appendix_text": None,
        "raw_content": None, # Fallback field for unparsed content
        "parsing_warnings": [] # List to store warnings
    }
}


# --- Regular Expression Patterns (mostly same as before) ---
PAGE_HEADER_RE = re.compile(r"^\s*--- 頁面 (\d+) \((.+?)\) ---", re.MULTILINE)
POEM_TITLE_CHAPTER_RE = re.compile(r"^(.+?)\s*（第(.+?)回）\s*$")
COLLECTION_TITLES = [
    "金陵十二钗图册判词", "红楼梦曲", "大观园题咏", "菊花诗", "螃蟹咏",
    "灯谜诗", "“女儿”酒令", "牙牌令", "花名签酒令八首", "柳絮词",
    "怀古绝句十首", "五美吟", "芙蓉女儿诔", "题大观园诸景对额",
    "贾祠联额三副", "酒令三首", "赏海棠花妖诗三首", "望江南・祝祭晴雯二首",
    "琴曲四章", "四时即事", "叹通灵玉二首"
]
COLLECTION_TITLE_CHAPTER_RE = re.compile(
    r"^(" + "|".join(re.escape(t) for t in COLLECTION_TITLES) + r")\s*（第(.+?)回）\s*$"
)
COLLECTION_ENTRY_TITLES = [
    r"其[一二三四五六七八九十]+（.+?）", r"其[一二三四五六七八九十]+",
    r"又副册判词之[一二]", r"副册判词一首", r"正册判词之[一二三四五六七八九十]+",
    r"引子", r"终身误", r"枉凝眉", r"恨无常", r"分骨肉", r"乐中悲", r"世难容",
    r"喜冤家", r"虚花悟", r"聪明累", r"留余庆", r"晚韶华", r"好事终", r"收尾・飞鸟各投林",
    r"忆菊", r"访菊", r"种菊", r"对菊", r"供菊", r"咏菊", r"画菊", r"问菊", r"簪菊", r"菊影", r"菊梦", r"残菊",
    r"咏红梅花得.+?字", r"访妙玉乞红梅",
    r"点绛唇・耍的猴儿谜",
]
POEM_COLLECTION_ENTRY_TITLE_RE = re.compile(
    r"^(" + "|".join(COLLECTION_ENTRY_TITLES) + r")\s*?$" # Allow optional trailing whitespace
)
SIMPLE_ENTRY_TITLE_CHAPTER_RE = re.compile(
     r"^(.+?赞|.+?对联|.+?偈|.+?歌|.+?词|.+?诗|.+?句|.+?书|.+?帖|.+?令)\s*（第(.+?)回）\s*$"
)
SECTION_MARKER_RE = re.compile(r"^\s*\[(说明|注释|鉴赏|评说|简释|备考|附录)\]\s*")
SECTION_NAME_MAP = {
    "说明": "explanation",
    "注释": "annotations",
    "鉴赏": "appreciation",
    "评说": "commentary",
    "简释": "commentary", # Map both to commentary
    "备考": "additional_notes_text", # Text stored here, title maybe separate
    "附录": "appendix_text"
}
PAINTING_DESC_RE = re.compile(r"^\s*画：(.+)")
COMMENTARY_TITLES = [
    "脂本《石头记》评诗选释", "曹雪芹与《红楼梦》", "论《红楼梦》中的诗词曲赋"
]
COMMENTARY_TITLE_RE = re.compile(r"^(" + "|".join(re.escape(t) for t in COMMENTARY_TITLES) + r")\s*$")
COMMENTARY_ENTRY_TITLES = [
    "浮生着甚苦奔忙", "有情原比无情苦", "天地循环秋复春", "阴阳交结变无伦",
    "请君着眼护官符", "万种豪华原是幻", "风流真假一般看", "幻情浓处故多嗔",
    "生死穷通何处真", "一物珍藏见至情", "自执金矛又执戈", "两宴不觉已深秋",
    "积德于今到子孙", "五首新诗何所居", "空将佛事图相报"
]
COMMENTARY_ENTRY_TITLE_RE = re.compile(r"^(" + "|".join(re.escape(t) for t in COMMENTARY_ENTRY_TITLES) + r")\s*$")
NOTE_TITLE_RE = re.compile(r"^\[备考\]“(.+?)”的含义")

# --- Helper Functions ---

def clean_text(text):
    """Removes leading/trailing whitespace from each line and the whole block."""
    if not text:
        return None
    lines = [line.strip() for line in text.strip().split('\n')]
    cleaned = "\n".join(lines).strip()
    return cleaned if cleaned else None # Return None if empty after cleaning

def parse_sections_robust(lines):
    """
    Parses content based on section markers, returning sections dict
    and the text block found *before* the first marker.
    """
    sections = {}
    text_before_first_marker = []
    current_section_key = None
    current_content = []
    first_marker_found = False

    for line in lines:
        marker_match = SECTION_MARKER_RE.match(line)
        if marker_match:
            # Store previous section content
            if current_section_key:
                sections[current_section_key] = clean_text("\n".join(current_content))

            # Start new section
            first_marker_found = True
            marker_name = marker_match.group(1)
            current_section_key = SECTION_NAME_MAP.get(marker_name, marker_name) # Use original name if not mapped
            current_content = []
            if current_section_key not in sections: sections[current_section_key] = None # Initialize
        elif first_marker_found and current_section_key is not None:
             # Append line to current section content
             current_content.append(line)
        elif not first_marker_found:
             # Accumulate lines before the first marker
             text_before_first_marker.append(line)

    # Store the last section's content
    if current_section_key:
        sections[current_section_key] = clean_text("\n".join(current_content))

    cleaned_text_before = clean_text("\n".join(text_before_first_marker))

    return cleaned_text_before, sections

def parse_page_content_robust(page_num, url, content):
    """
    Parses the content of a single page robustly, always returning
    a standard schema object.
    """
    page_data = copy.deepcopy(DEFAULT_SCHEMA) # Start with the standard structure
    page_data['page_number'] = page_num
    page_data['url'] = url
    details = page_data['details'] # Work directly on the details dict
    warnings = details['parsing_warnings']

    lines = content.strip().split('\n')
    if not lines:
        warnings.append("Page content is empty.")
        return page_data # Return default schema for empty page

    first_line = lines[0].strip()
    remaining_lines = lines[1:] if len(lines) > 1 else []
    full_page_body = "\n".join(lines) # Keep original body for raw_content fallback

    # --- Try to Identify Content Type and Parse ---
    try:
        collection_match = COLLECTION_TITLE_CHAPTER_RE.match(first_line)
        commentary_match = COMMENTARY_TITLE_RE.match(first_line)
        commentary_entry_match = COMMENTARY_ENTRY_TITLE_RE.match(first_line)
        poem_title_match = POEM_TITLE_CHAPTER_RE.match(first_line)
        simple_entry_match = SIMPLE_ENTRY_TITLE_CHAPTER_RE.match(first_line)
        note_title_match = NOTE_TITLE_RE.match(first_line)
        is_generic_note = first_line.startswith("[备考]") and not note_title_match

        # Parse sections first, as they are common to many types
        text_before_sections, sections = parse_sections_robust(remaining_lines)
        details.update(sections) # Add all found sections

        if commentary_match:
            page_data['content_type'] = "commentary"
            details['title'] = first_line
            # Combine pre-section text and section text if needed
            details['text'] = clean_text((text_before_sections or "") + "\n" + (details.get('text') or ""))
            if 'text' in sections: del sections['text'] # Avoid duplication if text was a section
            details.update(sections) # Update with other potential sections like [附录]

        elif collection_match:
            page_data['content_type'] = "poem_collection_introduction"
            details['collection_title'] = collection_match.group(1)
            details['chapter'] = collection_match.group(2)
            # Intro text is usually under [说明], but might be pre-section text
            details['text'] = details.get('explanation') or text_before_sections # Prioritize explanation section
            if 'explanation' in details: del details['explanation'] # Remove if used as main text


        elif commentary_entry_match:
             page_data['content_type'] = "commentary_entry"
             details['title'] = first_line
             # These often have [简释] (mapped to 'commentary') as the main text
             # Pre-section text might be the quoted poem
             if text_before_sections:
                 details['poem_text'] = [l.strip() for l in text_before_sections.split('\n') if l.strip()]
             # Main content is usually in 'commentary' section
             details['text'] = details.get('commentary')
             if 'commentary' in details: del details['commentary']


        elif poem_title_match or simple_entry_match:
             # Could be poem_entry or poem_collection_entry
             entry_title_part = first_line.split('（')[0].strip()
             is_collection_entry = bool(POEM_COLLECTION_ENTRY_TITLE_RE.match(entry_title_part))
             match = poem_title_match or simple_entry_match

             if is_collection_entry:
                 page_data['content_type'] = "poem_collection_entry"
                 details['title'] = entry_title_part # Store the specific entry title part
                 details['chapter'] = match.group(2)
             else:
                 page_data['content_type'] = "poem_entry"
                 details['title'] = match.group(1)
                 details['chapter'] = match.group(2)

             # Poem text is typically before sections, check for painting desc
             potential_poem_or_desc = text_before_sections.split('\n') if text_before_sections else []
             paint_match = PAINTING_DESC_RE.match(potential_poem_or_desc[0]) if potential_poem_or_desc else None
             if paint_match:
                 details['painting_description'] = paint_match.group(1).strip()
                 details['poem_text'] = [l.strip() for l in potential_poem_or_desc[1:] if l.strip()]
             else:
                 details['poem_text'] = [l.strip() for l in potential_poem_or_desc if l.strip()]


        elif note_title_match:
            page_data['content_type'] = "additional_notes"
            details['additional_notes_title'] = note_title_match.group(1)
            # Combine pre-section text and section text
            details['additional_notes_text'] = clean_text((text_before_sections or "") + "\n" + (details.get('additional_notes_text') or ""))
            if 'additional_notes_text' in sections: del sections['additional_notes_text'] # Avoid duplication


        elif is_generic_note:
             page_data['content_type'] = "additional_notes"
             details['additional_notes_title'] = "备考" # Generic title
             # Combine pre-section text and section text
             details['additional_notes_text'] = clean_text((text_before_sections or "") + "\n" + (details.get('additional_notes_text') or ""))
             if 'additional_notes_text' in sections: del sections['additional_notes_text'] # Avoid duplication

        else:
             # --- Fallback Logic ---
             # If no specific type matched, analyze the structure a bit
             poem_text_lines = [l.strip() for l in lines if l.strip()]

             # Simple couplet/quatrain/short text?
             if 1 <= len(poem_text_lines) <= 5 and not sections:
                 page_data['content_type'] = "poem_entry" # Assume simple poem/verse
                 details['title'] = f"Untitled Entry {page_num}"
                 details['poem_text'] = poem_text_lines
             # Otherwise, treat as general commentary/unknown
             else:
                 page_data['content_type'] = "commentary" # Default fallback
                 details['title'] = f"Page {page_num} Content"
                 details['text'] = clean_text(full_page_body) # Use the full body

    except Exception as e:
        # If any error occurs during parsing attempts, log it and store raw content
        error_msg = f"Internal parsing error on page {page_num}: {type(e).__name__} - {e}"
        print(error_msg)
        warnings.append(error_msg)
        page_data['content_type'] = "unknown_error" # Specific type for easier filtering
        details['raw_content'] = clean_text(full_page_body)
        # Clear potentially partially parsed details to avoid confusion
        for key in list(details.keys()):
            if key not in ['parsing_warnings', 'raw_content']:
                 if isinstance(DEFAULT_SCHEMA['details'][key], list):
                     details[key] = []
                 else:
                     details[key] = None

    # --- Final Cleanup and Validation ---
    # Ensure poem_text is always a list
    if not isinstance(details.get('poem_text'), list):
        details['poem_text'] = []

    # Remove empty warnings list if no warnings occurred
    if not details['parsing_warnings']:
        del details['parsing_warnings']

    # Remove raw_content if parsing was successful and it wasn't needed
    # (Check if any significant detail was parsed)
    if page_data['content_type'] != "unknown_error" and details.get('raw_content'):
         if details.get('title') or details.get('text') or details.get('poem_text') or any(details.get(k) for k in SECTION_NAME_MAP.values()):
              details['raw_content'] = None # Parsing likely succeeded enough

    # Final removal of None values from details IF they match the default schema's None
    # This ensures keys always exist but are null if not found/applicable
    for key, default_value in DEFAULT_SCHEMA['details'].items():
         if key not in details: # Should not happen due to deepcopy, but as safeguard
             if isinstance(default_value, list):
                  details[key] = []
             else:
                  details[key] = None
         elif details[key] is None and not isinstance(default_value, list):
              pass # Keep None if default is None
         elif isinstance(details[key], list) and not details[key] and isinstance(default_value, list):
             pass # Keep empty list if default is list
         # Optional: remove keys that are still None at the very end if desired?
         # No, requirement is to keep all keys.

    return page_data


def parse_file(input_path, output_path):
    """Reads the input file, parses each page, and writes JSON output."""
    if not os.path.exists(input_path):
        print(f"Error: Input file not found at '{input_path}'")
        return

    try:
        # Try UTF-8 first, then GBK as a fallback for Windows-created files
        encodings_to_try = ['utf-8', 'gbk']
        full_text = None
        for enc in encodings_to_try:
            try:
                with open(input_path, 'r', encoding=enc) as f:
                    full_text = f.read()
                print(f"Successfully read file with encoding: {enc}")
                break # Stop trying if read succeeds
            except UnicodeDecodeError:
                print(f"Failed to read file with encoding: {enc}, trying next...")
            except Exception as e:
                 print(f"Error reading file '{input_path}' with encoding {enc}: {e}")
                 return # General read error

        if full_text is None:
            print(f"Error: Could not read file '{input_path}' with any attempted encoding.")
            return

    except Exception as e:
        print(f"Error opening or reading file '{input_path}': {e}")
        return

    # Find all page headers and their positions
    headers = list(PAGE_HEADER_RE.finditer(full_text))
    parsed_data = []
    current_collection_info = {"title": None, "chapter": None} # For context tracking

    if not headers:
        print("Warning: No page headers found. Treating file as single block.")
        # Create a single entry for the whole file
        page_data = copy.deepcopy(DEFAULT_SCHEMA)
        page_data['page_number'] = 0
        page_data['url'] = "unknown"
        page_data['content_type'] = "commentary" # Assume commentary
        page_data['details']['title'] = "Full Text Content"
        page_data['details']['text'] = clean_text(full_text)
        parsed_data.append(page_data)
    else:
        # Iterate through pages based on headers
        for i, header_match in enumerate(headers):
            page_num = int(header_match.group(1))
            url = header_match.group(2).strip()
            content_start_index = header_match.end()

            # Determine content end index
            if (i + 1) < len(headers):
                content_end_index = headers[i+1].start()
            else:
                content_end_index = len(full_text)

            page_content = full_text[content_start_index:content_end_index].strip()

            # Parse the content for this page robustly
            parsed_page = parse_page_content_robust(page_num, url, page_content)

            # --- Basic Collection Context Management ---
            page_type = parsed_page.get('content_type')
            page_details = parsed_page.get('details', {})

            if page_type == 'poem_collection_introduction':
                current_collection_info['title'] = page_details.get('collection_title')
                current_collection_info['chapter'] = page_details.get('chapter')
                # print(f"Context set: Collection '{current_collection_info['title']}' (Ch {current_collection_info['chapter']})")

            elif page_type == 'poem_collection_entry':
                # Apply context if available and not already present
                if current_collection_info['title'] and not page_details.get('collection_title'):
                    page_details['collection_title'] = current_collection_info['title']
                if current_collection_info['chapter'] and not page_details.get('chapter'):
                    page_details['chapter'] = current_collection_info['chapter']

            # Reset context logic (can be refined)
            # Reset if a new collection starts, or if a major non-collection item appears
            elif page_type != 'poem_collection_entry':
                 # Reset only if a new collection INTRO is found, or a major commentary section.
                 # Let commentary_entries etc. potentially fall under the old context if needed?
                 # This reset logic might need tuning based on desired behavior for mixed pages.
                 # Let's reset more cautiously: only on new collection intro or major commentary titles.
                 if page_type == 'poem_collection_introduction' or page_type == 'commentary':
                     if current_collection_info['title']:
                          # print(f"Context reset on page {page_num} due to {page_type}")
                          current_collection_info = {"title": None, "chapter": None}


            parsed_data.append(parsed_page)


    # Write JSON output
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(parsed_data, f, ensure_ascii=False, indent=2)
        print(f"Successfully parsed '{input_path}' and saved JSON to '{output_path}'")
    except Exception as e:
        print(f"Error writing JSON file '{output_path}': {e}")

# --- Main Execution ---
if __name__ == "__main__":
    input_filename = "紅樓夢詩詞.txt"
    output_filename = "紅樓夢詩詞_structured.json" # New output name

    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_filepath = os.path.join(script_dir, input_filename)
    output_filepath = os.path.join(script_dir, output_filename)

    parse_file(input_filepath, output_filepath)