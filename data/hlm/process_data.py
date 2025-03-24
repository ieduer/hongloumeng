import json
import re

def process_hongloumeng(input_file_path, output_file_path):
    """
    Processes the Hong Lou Meng text file, merges paragraphs in each chapter,
    and saves the data in JSON format.

    Args:
        input_file_path: Path to the input text file.
        output_file_path: Path to the output JSON file.
    """

    chapters = []
    current_chapter = None
    chapter_content = ""

    with open(input_file_path, 'r', encoding='utf-8') as infile:
        for line in infile:
            line = line.strip()

            # Check for chapter start using regex (e.g., 第1章, 第10章, 第120章)
            chapter_match = re.match(r"(第?(\d+)章?)\s+(.+)", line)
            if chapter_match:
                if current_chapter:
                    # Save previous chapter
                    chapters.append({
                        "chapterNumber": current_chapter['chapterNumber'],
                        "title": current_chapter['title'],
                        "content": chapter_content.strip()
                    })
                    chapter_content = "" # Reset content for new chapter

                chapter_number_str = chapter_match.group(2)
                chapter_number = chapter_number_str if chapter_number_str.isdigit() else chapter_match.group(1)
                chapter_title = chapter_match.group(3).strip()
                current_chapter = {
                    "chapterNumber": chapter_number,
                    "title": chapter_title
                }
            elif line:
                chapter_content += line + " "  # Append line to current chapter content

        # Add the last chapter
        if current_chapter:
            chapters.append({
                "chapterNumber": current_chapter['chapterNumber'],
                "title": current_chapter['title'],
                "content": chapter_content.strip()
            })

    output_data = {"chapters": chapters}

    with open(output_file_path, 'w', encoding='utf-8') as outfile:
        json.dump(output_data, outfile, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    input_file = "红楼梦.txt"  # Replace with your input file path if different
    output_file = "hongloumeng_processed.json" # Replace with your desired output file name

    process_hongloumeng(input_file, output_file)
    print(f"Processed data saved to {output_file}")