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
    chapter_content = []

    with open(input_file_path, 'r', encoding='utf-8') as infile:
        text = infile.read()

        # Split text by chapter breaks based on the pattern "第X章"
        sections = re.split(r'(第\d+章.*?)\n', text)  # Splitting by the chapter title (e.g., 第1章)
        
        # Loop through the sections and pair each title with its content
        for i in range(1, len(sections), 2):
            chapter_title = sections[i].strip()
            chapter_text = sections[i + 1].strip()

            # Remove the ending mark like "(本章完)" from the chapter content
            chapter_text = re.sub(r"（本章完）", "", chapter_text).strip()

            # Append the chapter details to the list
            chapters.append({
                "chapterNumber": chapter_title.split()[0],  # Extracting chapter number (e.g., "第1章")
                "title": " ".join(chapter_title.split()[1:]),  # Extracting chapter title after "第X章"
                "content": chapter_text
            })

    # Save the processed data to a JSON file
    output_data = {"chapters": chapters}

    with open(output_file_path, 'w', encoding='utf-8') as outfile:
        json.dump(output_data, outfile, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    input_file = "红楼梦.txt"  # Path to the input text file
    output_file = "hongloumeng_processed.json"  # Desired output file name

    process_hongloumeng(input_file, output_file)
    print(f"Processed data saved to {output_file}")