/* 引入匯文明朝體，請確保字體文件在 assets/fonts 目錄下 */
@font-face {
  font-family: 'HuWenMingChaoTi';
  src: url('../fonts/HuWenMingChaoTi.woff2') format('woff2'),
       url('../fonts/HuWenMingChaoTi.woff') format('woff');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}

/* 全局樣式 */
body {
  font-family: 'HuWenMingChaoTi', "Noto Serif TC", serif;
  background: #f9f5e7;
  color: #333;
  margin: 0;
  padding: 0 10px;
  line-height: 1.6;
}

header, footer {
  text-align: center;
  padding: 1rem;
}

h1 {
  font-size: 2em;
  margin-bottom: 0.5em;
}

/* 夜晚模式 */
body.dark-mode {
  background: #1a1a1a;
  color: #f0f0f0;
}
body.dark-mode header,
body.dark-mode footer {
  background: #1a1a1a;
}
body.dark-mode #dialogue-box,
body.dark-mode #chapter-menu,
body.dark-mode #chapter-content {
  background: #2a2a2a;
  border-color: #444;
}

/* 切換目錄按鈕 */
#toggle-menu-btn {
  font-size: 1rem;
  padding: 0.5rem 1rem;
  margin-bottom: 1rem;
  cursor: pointer;
}

/* 主要內容區域 */
main {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 1rem;
}

/* 目錄區：採用網格布局，每行4個按鈕 */
#chapter-menu {
  margin-bottom: 1rem;
  background: #fff;
  border: 1px solid #ddd;
  padding: 1rem;
  display: none; /* 默認隱藏 */
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}
#chapter-menu button {
  width: 100%;
  text-align: center;
  padding: 0.5rem;
  border: 1px solid #0077cc;
  border-radius: 5px;
  background: #e0f0ff;
  cursor: pointer;
  transition: background 0.2s;
}
#chapter-menu button:hover {
  background: #cce4ff;
}

/* 章節內容區 */
#chapter-content {
  padding: 1rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 5px;
  margin-bottom: 1rem;
}

/* 對話窗口樣式 */
#dialogue-box {
  padding: 1.5rem;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}

/* 按鈕區 */
#button-area {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem;
  margin-bottom: 1rem;
}
#button-area button {
  flex-grow: 1;
  min-width: 150px;
  padding: 0.5rem 1rem;
  font-size: 1rem;
}

/* 答案輸入區：提高高度 */
#answer-section {
  margin-top: 1rem;
  display: none; /* 默認隱藏 */
}
#answer-section textarea {
  width: 100%;
  height: 6rem; /* 提高輸入區高度 */
  padding: 0.6rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 5px;
  box-sizing: border-box;
  margin-bottom: 0.8rem;
}
#answer-section textarea:focus {
  border-color: #0077cc;
  outline: none;
  box-shadow: 0 0 3px rgba(0, 119, 204, 0.3);
}

/* 按鈕共同樣式 */
button {
  border: 1px solid #0077cc;
  border-radius: 5px;
  background: #e0f0ff;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}
button:hover {
  background: #cce4ff;
}
button:active {
  transform: translateY(1px);
}

/* 響應式設計 */
@media (max-width: 768px) {
  body { padding: 0; }
  main { padding: 0 0.5rem; }
  h1 { font-size: 1.5em; }
  #dialogue-box { padding: 1rem; }
  #button-area { gap: 0.5rem; }
  #button-area button { padding: 0.6rem; font-size: 0.95rem; min-width: 120px; }
  #answer-section textarea { height: 4rem; }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  body { background: #1a1a1a; color: #f0f0f0; }
  #dialogue-box { background: #2a2a2a; border-color: #444; }
  button {
    background: #1a3d66;
    border-color: #2a5a8a;
    color: #f0f0f0;
  }
  button:hover { background-color: #2a5a8a; }
  #answer-section textarea {
    background: #333;
    color: #f0f0f0;
    border-color: #555;
  }
}