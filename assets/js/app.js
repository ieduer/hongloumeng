// 加载《红楼梦》章节数据
fetch('data/hongloumeng.json')
  .then(res => res.json())
  .then(data => {
    const chapterMenu = document.getElementById('chapter-menu');
    data.chapters.forEach(chapter => {
      const btn = document.createElement('button');
      btn.textContent = `${chapter.chapterNumber} - ${chapter.title}`;
      btn.onclick = () => loadChapter(chapter);
      chapterMenu.appendChild(btn);
    });
  })
  .catch(err => console.error('加载章节数据错误：', err));

// 在 app.js 中，给“显示目录”按钮添加事件监听
document.getElementById('toggle-menu-btn').addEventListener('click', () => {
  const menu = document.getElementById('chapter-menu');
  if (menu.style.display === 'none') {
    menu.style.display = 'block';
  } else {
    menu.style.display = 'none';
  }
});

function loadChapter(chapter) {
  document.getElementById('chapter-content').innerText = chapter.content;
  window.currentChapter = chapter;
  document.getElementById('messages').innerHTML = ''; // 清空对话区
}

// 生成模拟题，调整为先加载高考真题数据
function generateQuestion() {
  if (!window.currentChapter) {
    alert("請先選擇一個章節！");
    return;
  }
  // 读取高考真题数据
  fetch('data/gaokao.json')
    .then(res => res.json())
    .then(gaokao => {
      // 根据章节标题或内容尝试匹配相关题目
      let relevantQuestions = gaokao.data.filter(q => {
        return window.currentChapter.title.includes(q.chapter) || window.currentChapter.content.includes(q.chapter);
      });
      // 如果匹配不到，则使用全部数据作为参考
      if (relevantQuestions.length === 0) {
        relevantQuestions = gaokao.data;
      }
      // 随机选取一个题目作为参考
      const chosenQuestion = relevantQuestions[Math.floor(Math.random() * relevantQuestions.length)];

      // 构造指示词，结合高考真题整理说明和参考题目
      const prompt = `你是曹雪芹，基于以下高考《红楼梦》真题数据整理说明：“${gaokao.instructions}”。\n参考题目：${chosenQuestion.originalQuestion}\n请针对《红楼梦》第${window.currentChapter.chapterNumber}回内容设计一道高仿真模拟题，题型和真实高考题高度一致。`;

      callGeminiAPI(prompt, (result) => {
        document.getElementById('messages').innerHTML = `<div class="ai-message"><strong>生成的模擬題：</strong>${result}</div>`;
        window.currentQuestion = result;
      });
    })
    .catch(err => console.error('加载高考真题数据错误：', err));
}

// 显示答案输入区域
function showAnswerInput() {
  document.getElementById('answer-section').style.display = 'block';
}

// 提交答案后调用 Gemini API 获取标准答案与点评
function submitAnswer() {
  const studentAnswer = document.getElementById('userAnswer').value;
  if (!studentAnswer) {
    alert("請輸入答案！");
    return;
  }
  const prompt = `你是曹雪芹，基于近十年高考《红楼梦》真题出题模式，针对《红楼梦》第${window.currentChapter.chapterNumber}回生成的题目：“${window.currentQuestion}”，请给出标准答案，并对学生答案：“${studentAnswer}”逐点进行详细分析，指出不足并给出改进建议。`;
  
  callGeminiAPI(prompt, (result) => {
    document.getElementById('messages').innerHTML += `<div class="ai-message"><strong>標準答案與点评：</strong>${result}</div>`;
  });
}

// 调用 Gemini API 的函数（通过 Cloudflare Worker 代理）
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
    callback(data.response);
  })
  .catch(err => {
    console.error('API 調用錯誤：', err);
  });
}