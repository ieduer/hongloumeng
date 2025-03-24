// 加载《红楼梦》章节数据
fetch('data/hongloumeng.json')
  .then(res => res.json())
  .then(data => {
    const chapterMenu = document.getElementById('chapter-menu');
    data.chapters.forEach(chapter => {
      const btn = document.createElement('button');
      // 假設數據中章節號字段為 chapter，如有需要可改為 chapterNumber
      btn.textContent = `${chapter.chapter} - ${chapter.title}`;
      btn.onclick = () => loadChapter(chapter);
      chapterMenu.appendChild(btn);
    });
  })
  .catch(err => console.error('加载章节数据错误：', err));

// 给“显示目录”按钮添加事件监听，切换目录显示/隐藏（採用 grid 布局）
document.getElementById('toggle-menu-btn').addEventListener('click', () => {
  const menu = document.getElementById('chapter-menu');
  if (menu.style.display === 'none' || menu.style.display === '') {
    menu.style.display = 'grid';
  } else {
    menu.style.display = 'none';
  }
});

// 新增：切换黑暗模式事件监听（点击月亮按钮切换 body 的 dark-mode 类）
document.getElementById('toggle-dark-btn').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
});

// 加載章節時，插入分段處理（任務2）
function loadChapter(chapter) {
  // 若原文中無明顯分段符，將中文標點後插入換行標記
  let contentWithBreaks = chapter.content.replace(/(。|！|？)/g, '$1<br><br>');
  document.getElementById('chapter-content').innerHTML = contentWithBreaks;
  window.currentChapter = chapter;
  document.getElementById('messages').innerHTML = ''; // 清空對話區
  // 自動隱藏目錄
  document.getElementById('chapter-menu').style.display = 'none';
}

// 生成模拟题
function generateQuestion() {
  if (!window.currentChapter) {
    alert("請先選擇一個章節！");
    return;
  }
  // 顯示進度提示
  document.getElementById('messages').innerHTML = `<div class="ai-progress"><strong>提示：</strong>曹雪芹正在幫你分析高考題，請稍候...</div>`;
  
  fetch('data/gaokao.json')
    .then(res => res.json())
    .then(gaokao => {
      let relevantQuestions = gaokao.data.filter(q => {
        return window.currentChapter.title.includes(q.chapter) || window.currentChapter.content.includes(q.chapter);
      });
      if (relevantQuestions.length === 0) {
        relevantQuestions = gaokao.data;
      }
      const chosenQuestion = relevantQuestions[Math.floor(Math.random() * relevantQuestions.length)];
      const prompt = `你是曹雪芹，基于以下高考《红楼梦》真题数据整理说明：“${gaokao.instructions}”。\n参考题目：${chosenQuestion.originalQuestion}\n请针对《红楼梦》第${window.currentChapter.chapter}回内容设计一道高仿真模拟题，题型和真实高考题高度一致。回覆結構：本章情節概述：⋯⋯。高考真題與本章最相關的類型是⋯⋯，老夫給你出的模擬題是⋯⋯。注意：這一輪不要給答案`;
      
      callGeminiAPI(prompt, (result) => {
        // 將返回的文本按換行符分段格式化
        let paragraphs = result.split(/\n+/).filter(p => p.trim() !== '');
        let formattedReply = paragraphs.map(p => `<p>${p}</p>`).join('');
        document.getElementById('messages').innerHTML = `<div class="ai-message"><strong>生成的模擬題：</strong>${formattedReply}</div>`;
        window.currentQuestion = result;
      });
    })
    .catch(err => console.error('加载高考真题数据错误：', err));
}

// 顯示答案輸入區塊（單獨區塊，任務1要求）
function showAnswerInput() {
  document.getElementById('answer-section').style.display = 'block';
}

// 提交答案後，將答案區塊移到按鈕區下方（任務1）
function submitAnswer() {
  const studentAnswer = document.getElementById('userAnswer').value;
  if (!studentAnswer) {
    alert("請輸入答案！");
    return;
  }
  // 先顯示用戶答案
  document.getElementById('messages').innerHTML += `<div class="user-message"><strong>你的答案：</strong><p>${studentAnswer}</p></div>`;
  
  const prompt = `你是曹雪芹，基于近十年高考《红楼梦》真题出题模式，针对《红楼梦》第${window.currentChapter.chapter}回生成的題目：“${window.currentQuestion}”，请给出标准答案，并对学生答案：“${studentAnswer}”逐点进行详细分析，指出不足并给出改进建议。`;
  
  callGeminiAPI(prompt, (result) => {
    let paragraphs = result.split(/\n+/).filter(p => p.trim() !== '');
    let formattedReply = paragraphs.map(p => `<p>${p}</p>`).join('');
    document.getElementById('messages').innerHTML += `<div class="ai-message"><strong>標準答案與点评：</strong>${formattedReply}</div>`;
  });
}

// 調用 Gemini API 的函數（通過 Cloudflare Worker 代理）
function callGeminiAPI(prompt, callback) {
  fetch('https://hlm.bdfz.workers.dev', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  })
  .then(res => res.json())
  .then(data => {
    console.log('API返回数据：', data);
    callback(data.answer);
  })
  .catch(err => {
    console.error('API 調用錯誤：', err);
  });
}