# -*- coding: utf-8 -*-
import requests
from bs4 import BeautifulSoup
import time
import random
import re
import sys

# --- 配置 ---
BASE_URL = "http://www.guoxue123.com/hongxue/0001/scjs/{:03d}.htm"
START_PAGE = 0
END_PAGE = 170
OUTPUT_FILE = "紅樓夢詩詞曲賦鑑賞_合併_v4_全提取.txt" # 強調策略
MIN_DELAY = 1.5
MAX_DELAY = 4.0
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Connection': 'keep-alive',
}
# 擴展移除關鍵字列表，包含頂部和底部模板文字
REMOVE_KEYWORDS = [
    "上一页", "下一页", "目录页", "首页", "经部", "史部",
    "子部", "集部", "专题", "今人新著", "国学导航", "红学",
    "Powered by", "www.guoxue123.com", "Copyright", "All rights reserved",
    "©", # 版權符號的 HTML 實體
    # 考慮到標題可能混入，但標題是需要的，所以不直接移除《》內內容
]
# --- 配置結束 ---

def count_chinese_chars(text):
    """計算文本中常用 CJK 漢字的數量"""
    count = 0
    for char in text:
        # CJK Unified Ideographs 主要範圍
        if '\u4e00' <= char <= '\u9fff':
            count += 1
        # 可以根據需要添加 CJK 擴展區範圍，例如：
        # elif '\u3400' <= char <= '\u4dbf': # Extension A
        #     count += 1
        # elif '\u20000' <= char <= '\u2a6df': # Extension B
        #      count += 1
        # ... 其他擴展區 ...
    return count

total_downloaded_chars = 0

print(f"開始下載 《紅樓夢》詩詞曲賦鑑賞 從 {START_PAGE} 到 {END_PAGE}...")
print(f"策略：提取主要區域全部文本，再移除已知導航/模板。")
print(f"結果將合併到文件: {OUTPUT_FILE}")

# 使用 UTF-8 編碼寫入，確保能保存所有字符
with open(OUTPUT_FILE, "w", encoding="utf-8") as outfile:
    for i in range(START_PAGE, END_PAGE + 1):
        page_num_str = f"{i:03d}"
        url = BASE_URL.format(i)
        print(f"\n準備下載: {url}")

        delay = random.uniform(MIN_DELAY, MAX_DELAY)
        print(f"  延遲 {delay:.2f} 秒...")
        time.sleep(delay)

        try:
            response = requests.get(url, headers=HEADERS, timeout=20)
            response.raise_for_status()
            # --- **關鍵：正確解碼** ---
            # 網站聲明 charset=gb2312，必須用它解碼，否則可能亂碼或丟失字符
            response.encoding = 'gb2312'
            html_content = response.text
            print(f"  成功獲取: {url} (狀態碼: {response.status_code})")

            soup = BeautifulSoup(html_content, 'lxml')

            # --- **定位主要內容區 TD** ---
            content_td = soup.find('td', {'width': '87%'})
            if not content_td:
                print(f"  警告: 在 {url} 找不到主要內容容器 (td width='87%')。跳過此頁。")
                continue

            # --- **策略核心：提取 TD 內全部文本** ---
            # 使用 get_text 獲取所有可見文本，保留換行符
            raw_text = content_td.get_text(separator='\n', strip=True)

            # --- **進行文本清理和過濾** ---
            cleaned_text = raw_text

            # 1. 移除明確的關鍵字噪音
            for keyword in REMOVE_KEYWORDS:
                cleaned_text = cleaned_text.replace(keyword, "")

            # 2. 進一步清理：處理可能殘留的、僅由導航鏈接組成的行
            #    並去除多餘的空行和首尾空白
            lines = cleaned_text.split('\n')
            filtered_lines = []
            for line in lines:
                stripped_line = line.strip()
                # 過濾掉空行
                if not stripped_line:
                    continue
                # 過濾掉看起來只包含導航詞組合的行（更寬鬆的判斷）
                # （注意：這裡的判斷比較簡單，可能誤傷，但目的是去除明顯的導航行）
                # is_nav_line = all(word in ["上一页", "下一页", "目录页", ""] for word in stripped_line.split()) and len(stripped_line) < 20
                # if is_nav_line:
                #     continue
                # **更安全的做法：只移除空行和首尾空白**
                filtered_lines.append(stripped_line)

            # 3. 重新組合文本，並合併多個換行符為兩個（段落感）
            cleaned_text = "\n".join(filtered_lines)
            cleaned_text = re.sub(r'\n{2,}', '\n\n', cleaned_text).strip()


            # --- 計算有效漢字數量 ---
            # 這裡計數的是 Unicode 基本 CJK 區的漢字
            char_count = count_chinese_chars(cleaned_text)
            total_downloaded_chars += char_count

            if char_count > 0:
                 print(f"  提取到 {char_count} 個 CJK 漢字字符。")
            else:
                 # 即使漢字數為0，也可能包含標點或其他非漢字內容
                 if cleaned_text:
                     print(f"  提取到文本，但 CJK 漢字計數為 0。")
                 else:
                     print(f"  警告: 清理後未提取到任何有效文本內容。")


            # --- **寫入文件 (UTF-8)** ---
            # 即使漢字計數為0，只要清理後有文本，就寫入
            if cleaned_text:
                outfile.write(f"--- 頁面 {page_num_str} ({url}) ---\n\n")
                outfile.write(cleaned_text)
                outfile.write("\n\n")
            else:
                 print(f"  跳過寫入空頁面: {url}")

            sys.stdout.flush()

        except requests.exceptions.HTTPError as http_err:
            print(f"  錯誤: HTTP 錯誤 {http_err.response.status_code} 下載 {url}: {http_err}")
        except requests.exceptions.ConnectionError as conn_err:
            print(f"  錯誤: 連接錯誤下載 {url}: {conn_err}")
        except requests.exceptions.Timeout as timeout_err:
            print(f"  錯誤: 超時下載 {url}: {timeout_err}")
        except requests.exceptions.RequestException as req_err:
            print(f"  錯誤: 請求錯誤下載 {url}: {req_err}")
        except Exception as e:
            print(f"  處理頁面 {url} 時發生意外錯誤: {e}")
            # import traceback
            # print(traceback.format_exc()) # 用於調試

print(f"\n--------------------")
print(f"下載和合併完成。")
print(f"總共提取了 {total_downloaded_chars} 個 CJK 漢字字符。")
print(f"結果已保存到文件: {OUTPUT_FILE}")
print(f"--------------------")