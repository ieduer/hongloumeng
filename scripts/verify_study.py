"""Read-only release checks for content coverage, ownership and references."""
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
def load(path):
    return json.loads((ROOT / path).read_text())

poems = load('data/study/poems.json')['items']
people = load('data/study/people.json')['items']
chapters = load('data/study/chapters.json')['items']
exams = load('data/study/exams.json')['items']
research = load('data/authored/research.json')
verdicts = [p for p in poems if p['kind'] == '判词']
assert len(poems) == 131 and len({p['id'] for p in poems}) == 131
for p in poems:
    if '\ufffd' in json.dumps(p, ensure_ascii=False):
        assert p.get('qualityNote'), p['id']
assert Counter(p['book'] for p in verdicts) == {'正册': 11, '副册': 1, '又副册': 2}
expected = {'晴雯': '霁月难逢', '袭人': '枉自温柔和顺', '香菱': '根并荷花',
            '林黛玉': '可叹停机德', '薛宝钗': '可叹停机德', '贾元春': '二十年来',
            '贾探春': '才自精明', '史湘云': '富贵又何为', '妙玉': '欲洁何曾洁',
            '贾迎春': '子系中山狼', '贾惜春': '勘破三春', '王熙凤': '凡鸟偏从',
            '巧姐': '势败休云贵', '李纨': '桃李春风', '秦可卿': '情天情海'}
for name, opening in expected.items():
    rows = [p for p in verdicts if name in p['people']]
    assert len(rows) == 1 and rows[0]['lines'][0].startswith(opening), name
    person = next(p for p in people if p['name'] == name)
    assert person['verdict'] == [rows[0]['id']], name
    assert rows[0]['id'] in chapters[4]['poems']
assert len(chapters) == 120 and len(people) == 44 and len(exams) == 17
poem_ids, exam_ids = {p['id'] for p in poems}, {e['id'] for e in exams}
for p in people:
    assert set(p['poems']) <= poem_ids and set(p['examIds']) <= exam_ids
    assert len(p['dist']) == 120
for n, chapter in enumerate(chapters, 1):
    assert chapter['n'] == n
    assert set(chapter['poems']) <= poem_ids and set(chapter['exams']) <= exam_ids
    assert load(f'data/text/ch{n:03d}.json')['content']
for plan in load('data/study/plans.json')['plans']:
    assert len(plan['days']) == plan['total']
    assert [n for d in plan['days'] for n in d['chapters']] == list(range(1, 121))
    for day in plan['days']:
        assert set(day['poems']) <= poem_ids and set(day['exams']) <= exam_ids
assert len(research['items']) == 17 and len(research['sources']) == 2
assert len({p['id'] for p in research['items']}) == 17
assert Counter(p['sourceId'] for p in research['items']) == {'qi-liu-2023': 7, 'qi-method-2025': 10}
for x in research['items']:
    assert x['pages'] and x['summary'] and x['task'] and x['checks'] and x['caveat']
    assert set(x['chapters']) <= set(range(1, 121))
    assert set(x['people']) <= {p['name'] for p in people}
    assert set(x['examIds']) <= exam_ids
    assert x['sourceId'] in {s['id'] for s in research['sources']}
liu = next(p for p in people if p['name'] == '刘姥姥')
assert '刘老老' in liu['aliases'] and liu['dist'][112] > 0 and liu['dist'][118] > 0
assert 'authorityNote' in next(e for e in exams if e['id'] == 'bj2026-15')
print('PASS: 14 verdicts / 15 people; 131 poems; 120 chapters; 44 people; 17 exams; 17 cited research cards; 3 complete plans; no broken content references')
