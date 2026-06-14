# -*- coding: utf-8 -*-
"""Phase: Match genre tags to songs using MusicBrainz API + curated database + heuristics."""
import json, os, re, time, unicodedata
try:
    import requests
except ImportError:
    print('ERROR: requests is required. Install with: pip install requests')
    exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DATA_DIR = os.path.join(PROJECT_ROOT, 'data')
DATA_FILE = os.path.join(DATA_DIR, 'song_data.json')

# ═══════ Tag Mapping: MusicBrainz genre → Chinese tag ═══════
GENRE_MAP = {
    'j-pop': '流行', 'jpop': '流行', 'j-rock': '摇滚', 'jrock': '摇滚',
    'pop': '流行', 'rock': '摇滚', 'indie': '独立', 'indie pop': '独立',
    'indie rock': '摇滚', 'alternative': '摇滚', 'alternative rock': '摇滚',
    'folk': '民谣', 'r&b': 'R&B', 'rnb': 'R&B', 'hip hop': '说唱',
    'hip-hop': '说唱', 'rap': '说唱', 'electronic': '电子', 'edm': '电子',
    'dance': '电子', 'techno': '电子', 'house': '电子', 'trance': '电子',
    'anime': '动画', 'anison': '动画', 'vocaloid': 'Vocaloid',
    'ballad': '抒情', 'soul': '灵魂', 'blues': '蓝调', 'jazz': '爵士',
    'metal': '金属', 'heavy metal': '金属', 'punk': '朋克', 'punk rock': '朋克',
    'classical': '古典', 'reggae': '雷鬼', 'country': '乡村', 'ska': '斯卡',
    'shoegaze': '自赏', 'post-rock': '后摇', 'math rock': '数学摇滚',
    'city pop': 'City Pop', 'synth-pop': '合成器流行', 'synthpop': '合成器流行',
    'new wave': '新浪潮', 'power pop': '流行', 'soft rock': '摇滚',
    'hard rock': '摇滚', 'progressive rock': '摇滚', 'grunge': '摇滚',
    'britpop': '摇滚', 'emo': '情绪摇滚', 'screamo': '情绪摇滚',
    'pop rock': '流行', 'pop punk': '朋克', 'folk rock': '民谣',
    'chamber pop': '流行', 'dream pop': '梦幻流行', 'lo-fi': 'Lo-Fi',
    'lofi': 'Lo-Fi', 'ambient': '氛围', 'post-punk': '后朋',
    'funk': '放克', 'disco': '迪斯科', 'bossa nova': '巴萨诺瓦',
    'swing': '爵士', 'dubstep': '电子', 'drum and bass': '电子',
    'k-pop': 'K-Pop', 'kpop': 'K-Pop', 'c-pop': '流行',
    'mandopop': '流行', 'cantopop': '流行',
    'video game': '游戏', 'game': '游戏', 'chiptune': '游戏',
    'soundtrack': '影视', 'musical': '音乐剧',
}

# ═══════ Curated Tag Database: well-known songs ═══════
SONG_TAGS = {
    # Japanese anime themes
    '君の知らない物語': ['动画', '摇滚'], 'Only my railgun': ['动画', '电子'],
    '残酷な天使のテーゼ': ['动画', '摇滚'], '紅蓮華': ['动画', '摇滚'],
    '廻廻奇譚': ['动画', '摇滚'], 'Unravel': ['动画', '摇滚'],
    '青空のラプソディ': ['动画', '流行'], 'Snow halation': ['动画', '流行'],
    'Daydream café': ['动画', '流行'], 'God knows': ['动画', '摇滚'],
    'secret base': ['动画', '抒情'], 'Butter-Fly': ['动画', '摇滚'],
    'only my railgun': ['动画', '电子'], 'Gurenge': ['动画', '摇滚'],
    '炎': ['动画', '流行'], '怪物': ['动画', '摇滚'],
    'アイドル': ['动画', '流行'], 'KICK BACK': ['动画', '摇滚'],
    'SPARK-LE': ['动画', '流行'], 'Brave Shine': ['动画', '摇滚'],
    'Last Stardust': ['动画', '摇滚'], 'One Last Kiss': ['影视', '流行'],
    'First Love': ['抒情', '流行'], 'lemon': ['抒情', '流行'],
    'Lemon': ['抒情', '流行'], 'Plastic Love': ['City Pop', '流行'],
    'LOVE 2000': ['流行', '舞曲'], 'WHITE ALBUM': ['动画', '抒情'],
    'メルト': ['Vocaloid', '流行'], 'from Y to Y': ['Vocaloid', '抒情'],
    'Letter Song': ['Vocaloid', '抒情'], '心做し': ['Vocaloid', '抒情'],
    '命に嫌われている。': ['Vocaloid', '摇滚'], '8.32': ['Vocaloid', '流行'],
    '深海少女': ['Vocaloid', '摇滚'], 'サマータイムレコード': ['Vocaloid', '摇滚'],
    'Drop Pop Candy': ['Vocaloid', '流行'], 'Rainbow Girl': ['Vocaloid', '流行'],
    '好き！雪！本気マジック': ['Vocaloid', '流行'], '心拍数#0822': ['Vocaloid', '流行'],
    'シリョクケンサ（视力检查）': ['Vocaloid', '流行'],
    'tune the rainbow': ['动画', '流行'], 'エウテルペ': ['动画', '抒情'],
    'Departures': ['动画', '抒情'], 'Ghost of a smile': ['动画', '抒情'],
    'デイジー': ['动画', '抒情'], 'hacking to the gate': ['动画', '摇滚'],
    'again': ['动画', '摇滚'], 'Again': ['动画', '摇滚'],
    'シュガーソングとビターステップ': ['动画', '摇滚'],
    'センチメートル': ['动画', '流行'], 'DAYBREAK FRONTLINE': ['动画', '摇滚'],

    # Yorushika / Hachi / Kenshi Yonezu
    'ただ君に晴れ': ['摇滚', '流行'], 'だから僕は音楽を辞めた': ['摇滚', '流行'],
    '花に亡霊': ['摇滚', '抒情'], '春泥棒': ['摇滚', '流行'],
    '又三郎': ['摇滚', '流行'], '言って。': ['摇滚', '流行'],
    '都落ち': ['摇滚', '流行'], '風を食む': ['摇滚', '流行'],
    'レオ': ['摇滚', '抒情'], '少年時代': ['摇滚', '流行'],
    'パレード': ['摇滚', '流行'], '雲と幽霊': ['摇滚', '抒情'],

    # Hachi / Kenshi Yonezu
    'グリグリメガネと月光蟲': ['Vocaloid', '摇滚'],
    'クリームソーダとシャンデリア': ['Vocaloid', '摇滚'],
    'センチメンタルな愛慕心': ['Vocaloid', '摇滚'],
    'メリュー': ['Vocaloid', '抒情'], 'メリーメリ': ['Vocaloid', '流行'],
    '刹那プラス': ['Vocaloid', '摇滚'],

    # Balloon / Keina Suda
    'ハイドアンド・シーク': ['摇滚', '流行'], 'メリーメリ': ['摇滚', '流行'],
    '嘘つき': ['摇滚', '流行'], '続・へたくそユートピア政策': ['Vocaloid', '摇滚'],

    # Yoasobi / J-pop hits
    '夜に駆ける': ['流行', '摇滚'], '怪物': ['流行', '摇滚'],
    '群青': ['流行', '摇滚'], 'ハルジオン': ['流行', '摇滚'],
    'あの夢をなぞって': ['流行', '摇滚'],

    # Chinese pop classics
    '流沙': ['R&B', '流行'], '普通朋友': ['R&B', '流行'],
    '爱很简单': ['R&B', '抒情'], '沙滩': ['R&B', '抒情'],
    '找自己': ['R&B', '流行'], '天天': ['R&B', '流行'],
    '就是爱你': ['R&B', '抒情'], 'Melody': ['R&B', '抒情'],
    '反方向的钟': ['流行', 'R&B'], '晴天': ['流行', '摇滚'],
    '七里香': ['流行', '抒情'], '简单爱': ['流行', '抒情'],
    '稻香': ['流行', '说唱'], '夜曲': ['流行', '抒情'],
    '告白气球': ['流行', '抒情'], '等你下课': ['流行', '抒情'],
    '不能说的秘密': ['流行', '抒情'], '一路向北': ['流行', '摇滚'],
    '以父之名': ['流行', '说唱'], '双截棍': ['流行', '说唱'],
    '忍者': ['流行', '说唱'], '本草纲目': ['流行', '说唱'],
    '给我一首歌的时间': ['流行', '抒情'], '上海一九四三': ['流行', '抒情'],
    '入秋的第一场雨真让人矫情': ['独立', '流行'], '屑屑': ['独立', '流行'],
    '交织together': ['独立', '流行'], '社畜烧酒': ['独立', '流行'],
    '小幸运': ['抒情', '影视'], '起风了': ['抒情', '流行'],
    '修炼爱情': ['抒情', '流行'], '修炼爱情': ['抒情', '流行'],
    '说散就散': ['抒情', '流行'], '体面': ['抒情', '影视'],
    '那些年': ['抒情', '影视'], '后来': ['抒情', '流行'],
    '匆匆那年': ['抒情', '影视'], '红豆': ['抒情', '流行'],
    '容易受伤的女人': ['抒情', '流行'], '暧昧': ['抒情', '流行'],
    '遗失的美好': ['抒情', '流行'], '隐形的翅膀': ['抒情', '流行'],
    '欧若拉': ['流行', '舞曲'], '亲爱的，那不是爱情': ['抒情', '流行'],
    '有形的翅膀': ['抒情', '流行'], '小宇': ['抒情', '流行'],
    '怎么了': ['抒情', '流行'], '以后别做朋友': ['抒情', '流行'],
    '童话': ['抒情', '流行'], '第一次': ['抒情', '流行'],
    '勇气': ['抒情', '流行'], '宁夏': ['抒情', '流行'],
    '可惜不是你': ['抒情', '流行'], '会呼吸的痛': ['抒情', '流行'],
    '忽然之间': ['抒情', '流行'], '阴天': ['抒情', '流行'],
    '如果没有你': ['抒情', '流行'], '盛夏的果实': ['抒情', '流行'],
    '他不爱我': ['抒情', '流行'], '电台情歌': ['抒情', '流行'],
    '爱情': ['抒情', '流行'], '外面的世界': ['抒情', '流行'],
    '慢慢喜欢你': ['抒情', '流行'], '这世界那么多人': ['抒情', '流行'],
    '光年之外': ['抒情', '影视'], '泡沫': ['抒情', '流行'],
    '倒数': ['抒情', '流行'], '句号': ['抒情', '流行'],
    '来自天堂的魔鬼': ['摇滚', '流行'], '差不多姑娘': ['说唱', '流行'],
    '漂洋过海来看你': ['抒情', '流行'], '鬼迷心窍': ['抒情', '流行'],
    '当爱已成往事': ['抒情', '流行'], '山丘': ['抒情', '摇滚'],
    '给自己的歌': ['抒情', '摇滚'], '问（DJ版）': ['抒情', '流行'],
    '爱的代价': ['抒情', '流行'], '凡人歌': ['抒情', '摇滚'],
    '让我欢喜让我忧': ['抒情', '流行'], '爱如潮水': ['抒情', '流行'],
    '过火': ['抒情', '流行'], '信仰': ['抒情', '流行'],
    '太委屈': ['抒情', '流行'], '值得': ['抒情', '流行'],
    '至少还有你': ['抒情', '流行'], '伤痕': ['抒情', '流行'],
    '我怀念的': ['抒情', '流行'], '天黑黑': ['抒情', '流行'],
    '遇见': ['抒情', '流行'], '开始懂了': ['抒情', '流行'],
    '尚好的青春': ['抒情', '流行'], '逃亡': ['抒情', '流行'],
    '绿光': ['抒情', '流行'], '原来你什么都不要': ['抒情', '流行'],
    '听海': ['抒情', '流行'], '记得': ['抒情', '流行'],
    '真实': ['抒情', '流行'], '我要快乐': ['抒情', '流行'],
    '掉了': ['抒情', '流行'], '我最亲爱的': ['抒情', '流行'],
    '也许明天': ['抒情', '流行'], '血腥爱情故事': ['摇滚', '流行'],
    '母系社会': ['摇滚', '流行'], '开门见山': ['摇滚', '流行'],
    '王妃': ['摇滚', '流行'], '新不了情': ['抒情', '流行'],
    'Superwoman': ['R&B', '抒情'], 'Letting Go': ['抒情', '流行'],
    '空白格': ['抒情', '流行'], '达尔文': ['抒情', '流行'],
    '红色高跟鞋': ['抒情', '流行'], '越来越不懂': ['抒情', '流行'],
    '别找我麻烦': ['抒情', '流行'], '抛物线': ['抒情', '流行'],
    '说到爱': ['抒情', '流行'], 'After 17': ['独立', '流行'],
    '旅行的意义': ['独立', '流行'], '鱼': ['独立', '流行'],
    '还是会寂寞': ['独立', '流行'], '太聪明': ['独立', '流行'],
    'After 17': ['独立', '流行'], '太聪明': ['独立', '流行'],
    '告诉我': ['独立', '流行'], '让我想一想': ['独立', '流行'],
    'self': ['独立', '流行'], '微凉的你': ['独立', '流行'],
    '小步舞曲': ['独立', '流行'], '躺在你的衣柜': ['独立', '流行'],
    '坐你隔壁': ['独立', '流行'], '我喜欢上你时的内心活动': ['独立', '流行'],
    'Last Kiss': ['独立', '抒情'], '华丽的冒险': ['独立', '流行'],

    # English / Western
    'Someone Like You': ['抒情', '流行'], 'Rolling in the Deep': ['流行', '灵魂'],
    'Stay With Me': ['抒情', '流行'], 'I\'m Not the Only One': ['抒情', '流行'],
    'Lay Me Down': ['抒情', '流行'], 'Too Good at Goodbyes': ['抒情', '流行'],
    'Lover': ['抒情', '流行'], 'Cruel Summer': ['流行', '合成器流行'],
    'Blank Space': ['流行', '合成器流行'], 'Shake It Off': ['流行', '舞曲'],
    'Anti-Hero': ['流行', '合成器流行'], 'Lavender Haze': ['流行', '梦幻流行'],
    'From The Start': ['爵士', '流行'], 'Let It Be': ['摇滚', '经典'],
    'Hey Jude': ['摇滚', '经典'], 'Yesterday': ['摇滚', '经典'],
    "Don't Look Back in Anger": ['摇滚', '经典'], 'Wonderwall': ['摇滚', '经典'],
    'Fly Me to the Moon': ['爵士', '经典'], 'Just The Two Of Us': ['爵士', 'R&B'],
    'Kiss Me': ['抒情', '流行'], 'Stand by Me': ['经典', '灵魂'],
    'stand by me': ['经典', '灵魂'], 'City of Stars': ['抒情', '影视'],
    'Remember me': ['抒情', '影视'], 'Try Everything': ['流行', '舞曲'],
    'Say So': ['流行', '迪斯科'], 'Someone You Loved': ['抒情', '流行'],
    'Before You Go': ['抒情', '流行'], 'Hold Me While You Wait': ['抒情', '流行'],
    'Forever Young': ['经典', '摇滚'], 'One More Light': ['摇滚', '流行'],
    'Numb': ['摇滚', '金属'], 'In the End': ['摇滚', '金属'],
    'I Really Want to Stay at Your House': ['抒情', '游戏'],
    'hacking to the gate': ['动画', '摇滚'],
    'me me she': ['流行', 'R&B'], 'No title': ['流行', '电子'],
    'Upupu': ['动画', '流行'], 'Virtual To LIVE': ['动画', '流行'],

    # Korean
    'Ditto': ['K-Pop', '流行'], 'Hype Boy': ['K-Pop', '流行'],
    'Love Dive': ['K-Pop', '流行'], 'After LIKE': ['K-Pop', '流行'],
    'Eleven': ['K-Pop', '流行'], 'I AM': ['K-Pop', '流行'],

    # Specific artists
    '怪獣の花唄': ['摇滚', '流行'], '悪魔の子': ['摇滚', '动画'],
    '私じゃなかったんだね': ['抒情', '流行'], 'あなたがいた森': ['抒情', '摇滚'],
    'さよならの夏': ['抒情', '影视'], 'とびら開けて': ['抒情', '动画'],
    'とりのこしてィ': ['摇滚', '流行'], 'ひまわりの約束': ['抒情', '流行'],
    'アイディスマイル': ['流行', '摇滚'], 'キセキ～未来へ～': ['流行', '动画'],
    'キミの記憶': ['抒情', '动画'], 'コールボーイ': ['摇滚', '流行'],
    'トリノコシティ': ['Vocaloid', '摇滚'], '割れたリンゴ': ['抒情', '动画'],
    '君との明日': ['抒情', '流行'], '運命のルーレット廻して': ['动画', '摇滚'],
    '雪は何色': ['抒情', '摇滚'], '風に薫る夏の記憶': ['抒情', '流行'],
    'For フルーツバスケット': ['动画', '抒情'], '懐中道标': ['抒情', '流行'],
    'ビードロ模様': ['抒情', '流行'], 'あおぞら': ['Vocaloid', '流行'],
    '行かないで': ['抒情', '经典'], '貴方の恋人になりたい': ['摇滚', '流行'],
    '雨と体臭': ['摇滚', '流行'], '夏霞': ['抒情', '流行'],
    '夕日坂': ['Vocaloid', '抒情'], '鳥の詩': ['动画', '抒情'],
    '鸟之诗': ['动画', '抒情'], '変わらないもの': ['抒情', '流行'],
    '妄想感傷代償連盟': ['Vocaloid', '摇滚'], 'Rainbow Girl': ['Vocaloid', '流行'],
    '丸ノ内サディスティック': ['爵士', '摇滚'], 'ギブス': ['摇滚', '流行'],
    '恋': ['流行', '摇滚'], 'LOVE': ['流行', '摇滚'],
    'ドラえもん': ['流行', '抒情'], 'ひまわり': ['流行', '抒情'],
    'Subaru': ['抒情', '经典'], '昴': ['抒情', '经典'],
    '乾杯': ['抒情', '流行'], '栄光の架橋': ['抒情', '流行'],
    'ハナミズキ': ['抒情', '流行'], 'First Love': ['抒情', '流行'],
    'Automatic': ['R&B', '流行'], 'traveling': ['流行', '电子'],
    'Flavor Of Life': ['抒情', '流行'], 'Can You Keep A Secret?': ['流行', 'R&B'],

    # Chinese indie / niche
    '化身孤岛的鲸': ['抒情', '流行'], '易燃易爆炸': ['独立', '摇滚'],
    '星星和雨的夜': ['古风', '抒情'], '月出': ['古风', '抒情'],
    '采茶纪': ['古风', '流行'], '绮凝盏': ['古风', '流行'],
    '莹梦': ['古风', '抒情'], '页角情书': ['古风', '抒情'],
    '虫儿飞': ['经典', '抒情'], '茉莉花': ['经典', '民歌'],
    '送别': ['经典', '民歌'], '友谊地久天长': ['经典', '民歌'],
    '雪绒花': ['经典', '影视'], '说唱脸谱': ['经典', '说唱'],
    '大东北我的家乡': ['摇滚', '民俗'], '败家娘们儿': ['民俗', '流行'],
    '加油鸭': ['流行', '游戏'], '眼镜的葬礼': ['流行', '游戏'],
    '夜宴风波': ['电子', '古风'], '地狱先生': ['流行', '古风'],
    '神的随波逐流': ['流行', '摇滚'], '私奔到月球': ['抒情', '流行'],
    '走在冷风中': ['抒情', '流行'], '阳光下的星星': ['抒情', '流行'],
    '别那么骄傲': ['抒情', '流行'], '蝴蝶': ['R&B', '流行'],
    '下等马': ['独立', '流行'], '老娘驾到': ['独立', '流行'],
    '花,太阳,彩虹,你': ['抒情', '民谣'], '走在冷风中': ['抒情', '流行'],
    '狐狸精': ['流行', '舞曲'], '爱你但说不出口': ['抒情', '流行'],
    '爆刘继芬': ['独立', '流行'], '干物女': ['流行', '舞曲'],
    '心愿便利贴': ['流行', '抒情'], '恋爱语音导航': ['Vocaloid', '流行'],
    '悠哉日常': ['动画', '流行'], '明天你好': ['抒情', '流行'],
    '思想犯': ['独立', '流行'], '一人行者': ['抒情', '流行'],
    '两个恰恰好': ['摇滚', '流行'], '回留': ['抒情', '流行'],
    '天使': ['摇滚', '流行'], '知足': ['摇滚', '抒情'],
    '温柔': ['摇滚', '抒情'], '倔强': ['摇滚', '流行'],
    '突然好想你': ['抒情', '摇滚'], '干杯': ['抒情', '摇滚'],
    '后来的我们': ['抒情', '摇滚'], '伤心的人别听慢歌': ['摇滚', '流行'],
    '我不愿让你一个人': ['抒情', '摇滚'], '你不是真正的快乐': ['抒情', '摇滚'],
    '星空': ['抒情', '摇滚'], '拥抱': ['抒情', '摇滚'],
    '恋爱ing': ['流行', '摇滚'], '派对动物': ['摇滚', '流行'],
    'OAOA': ['摇滚', '流行'], '好好': ['抒情', '摇滚'],
    '小薇': ['流行', '抒情'], '对面的女孩看过来': ['流行', '抒情'],
    '浪花一朵朵': ['流行', '抒情'], '伤心太平洋': ['流行', '抒情'],
    '我是一只鱼': ['流行', '抒情'], '春天花会开': ['流行', '抒情'],
    '睡在我上铺的兄弟': ['民谣', '经典'], '恋恋风尘': ['民谣', '经典'],
    '同桌的你': ['民谣', '经典'], '一生有你': ['民谣', '抒情'],
    '那些花儿': ['民谣', '抒情'], '平凡之路': ['民谣', '摇滚'],
    '成都': ['民谣', '抒情'], '南山南': ['民谣', '抒情'],
    '董小姐': ['民谣', '抒情'], '斑马斑马': ['民谣', '抒情'],
    '无赖': ['抒情', '流行'], '你的眼睛背叛你的心': ['抒情', '流行'],
    '左右为难': ['抒情', '流行'], '绝口不提爱你': ['抒情', '流行'],
    '我真的受伤了': ['抒情', '流行'], '你的名字我的姓氏': ['抒情', '流行'],
    '每天爱你多一些': ['抒情', '流行'], '一千个伤心的理由': ['抒情', '流行'],
    '吻别': ['抒情', '流行'], '她来听我的演唱会': ['抒情', '流行'],
    '如果爱': ['抒情', '影视'], '遥远的她': ['抒情', '流行'],
    '只想一生跟你走': ['抒情', '流行'], '李香兰': ['抒情', '流行'],

    # More Vocaloid
    '火葬场之歌': ['Vocaloid', '流行'], 'トリノコシティ': ['Vocaloid', '摇滚'],
    '恋愛裁判': ['Vocaloid', '流行'], 'ロキ': ['Vocaloid', '摇滚'],
    '砂の惑星': ['Vocaloid', '抒情'], 'ハジメテノオト': ['Vocaloid', '抒情'],
    '千本桜': ['Vocaloid', '摇滚'], 'Tell Your World': ['Vocaloid', '流行'],
    'ODDS & ENDS': ['Vocaloid', '抒情'], 'World is Mine': ['Vocaloid', '流行'],

    # 愛言葉 series
    '愛言葉IV': ['Vocaloid', '抒情'], '愛言葉III': ['Vocaloid', '抒情'],
    '愛言葉II': ['Vocaloid', '抒情'], '愛言葉': ['Vocaloid', '抒情'],

    # Other known songs
    '香水': ['摇滚', '流行'], '群青日和': ['摇滚', '流行'],
    'Don\'t cry Don\'t cry': ['独立', '流行'],
    'Alice in 冷凍庫': ['独立', '流行'],
    'I Love You 3000': ['流行', '抒情'],
    'rain stops, good-bye': ['抒情', '流行'],
    'rain stops,good-bye': ['抒情', '流行'],
    'one more time one more chance': ['抒情', '影视'],
    'あの夏が飽和する。': ['Vocaloid', '抒情'],
    'シンクロサイクロトロン・スピリチュアライザー': ['Vocaloid', '摇滚'],
    'シンクロサイクロトロン・スピリチュアライザー。': ['Vocaloid', '摇滚'],
    '歩いても 歩いても': ['摇滚', '抒情'], '莉回る空うさぎ': ['Vocaloid', '摇滚'],
    '给远在天边的你': ['抒情', '动画'],
    'WHITEEALBUM': ['动画', '抒情'],
    'from Y to Y': ['抒情', '摇滚'],
}

# ═══════ Artist-based tag defaults ═══════
ARTIST_TAGS = {
    '周杰伦': ['流行', 'R&B'], '陶喆': ['R&B', '流行'], '王力宏': ['R&B', '流行'],
    '林俊杰': ['流行', '抒情'], '陈奕迅': ['流行', '抒情'], '张学友': ['抒情', '流行'],
    '张惠妹': ['流行', '摇滚'], '蔡健雅': ['独立', '抒情'], '陈绮贞': ['独立', '流行'],
    '孙燕姿': ['抒情', '流行'], '莫文蔚': ['抒情', '流行'], '张韶涵': ['流行', '抒情'],
    '梁静茹': ['抒情', '流行'], '田馥甄': ['抒情', '流行'], 'A-Lin': ['抒情', '流行'],
    '徐佳莹': ['抒情', '流行'], '邓紫棋': ['流行', '摇滚'], '蔡依林': ['流行', '舞曲'],
    '萧敬腾': ['摇滚', '流行'], '周兴哲': ['抒情', '流行'], '韦礼安': ['流行', 'R&B'],
    '五月天': ['摇滚', '流行'], '苏打绿': ['独立', '摇滚'], '告五人': ['独立', '摇滚'],
    '旺福': ['独立', '摇滚'], 'Tizzy Bac': ['独立', '摇滚'],
    '泠鸢yousa': ['独立', '古风'], 'ChiliChill': ['独立', '流行'],
    '双笙': ['古风', '流行'], '银临': ['古风', '抒情'], '音阙诗听': ['电子', '古风'],
    '宇多田ヒカル': ['抒情', '流行'], 'aiko': ['抒情', '流行'], '椎名林檎': ['爵士', '摇滚'],
    'ヨルシカ': ['摇滚', '流行'], '米津玄師': ['摇滚', '流行'], 'ハチ': ['Vocaloid', '摇滚'],
    'Vaundy': ['摇滚', '流行'], 'Aimer': ['抒情', '摇滚'], 'LiSA': ['动画', '摇滚'],
    '中島愛': ['抒情', '流行'], '秦基博': ['抒情', '流行'], 'コブクロ': ['抒情', '流行'],
    'やなぎなぎ': ['抒情', '流行'], 'EGOIST': ['动画', '抒情'], 'supercell': ['动画', '摇滚'],
    'ryo': ['Vocaloid', '流行'], '40mP': ['Vocaloid', '流行'], '蝶々P': ['Vocaloid', '流行'],
    'バルーン': ['摇滚', '流行'], 'カンザキイオリ': ['Vocaloid', '抒情'],
    'Orangestar': ['Vocaloid', '流行'], '*Luna': ['Vocaloid', '流行'],
    'DECO*27': ['Vocaloid', '摇滚'], 'syudou': ['Vocaloid', '摇滚'],
    'じん': ['Vocaloid', '摇滚'], '164': ['Vocaloid', '摇滚'],
    'Giga': ['Vocaloid', '电子'], 'Mitchie M': ['Vocaloid', '流行'],
    '初音ミク': ['Vocaloid', '流行'], '初音未来': ['Vocaloid', '流行'],
    '中森明菜': ['抒情', '经典'], 'ZARD': ['摇滚', '流行'], '平野綾': ['动画', '流行'],
    '安室奈美恵': ['流行', '舞曲'], '坂本真綾': ['动画', '抒情'],
    '手嶌葵': ['抒情', '影视'], '樹海': ['抒情', '摇滚'],
    '神前暁': ['动画', '抒情'], 'まふまふ': ['摇滚', '流行'],
    'そらる': ['流行', '抒情'], 'いとうかなこ': ['动画', '摇滚'],
    'Linked Horizon': ['摇滚', '动画'], 'UNISON SQUARE GARDEN': ['摇滚', '动画'],
    'tuki.': ['流行', '摇滚'], 'HoneyWorks': ['流行', '动画'],
    'Kalafina': ['抒情', '动画'], 'May\'n': ['动画', '摇滚'],
    'ヒグチアイ': ['摇滚', '动画'], '西野カナ': ['抒情', '流行'],
    '渡辺麻友': ['流行', '动画'], '岡崎律子': ['动画', '抒情'],
    'くるり': ['摇滚', '抒情'], '山崎まさよし': ['抒情', '流行'],
    'The Beatles': ['摇滚', '经典'], 'Oasis': ['摇滚', '经典'],
    'Adele': ['抒情', '流行'], 'Sam Smith': ['抒情', '流行'],
    'Taylor Swift': ['流行', '抒情'], 'Bruno Mars': ['流行', 'R&B'],
    'Laufey': ['爵士', '流行'], 'Sixpence None the Richer': ['抒情', '流行'],
    'Ben E. King': ['经典', '灵魂'], 'Frank Sinatra': ['爵士', '经典'],
    'YUI': ['摇滚', '流行'], 'Reol': ['流行', '电子'],
    'Doja Cat': ['流行', '说唱'], 'Shakira': ['流行', '舞曲'],
    'Lewis Capaldi': ['抒情', '流行'], 'Linkin Park': ['摇滚', '金属'],
    'Grover Washington Jr.': ['爵士', 'R&B'], 'Ryan Gosling': ['抒情', '影视'],
    '竹内まりや': ['City Pop', '流行'], 'Stephanie Poetri': ['流行', '抒情'],
    'Rosa Walton': ['抒情', '游戏'], 'いとうかなこ': ['动画', '摇滚'],
    'にじさんじ': ['动画', '流行'], 'Jimmy Eat World': ['摇滚', '流行'],
    'The Script': ['抒情', '流行'], 'Bob Dylan': ['经典', '民谣'],
    '小缘': ['流行', '古风'], '茶理理': ['独立', '流行'],
    '王贰浪': ['抒情', '流行'], '徐良': ['流行', '电子'],
    '封茗囧菌': ['流行', '舞曲'], '元若蓝': ['流行', '抒情'],
    '洛天依': ['Vocaloid', '流行'], 'ilem': ['Vocaloid', '流行'],
    'のんのんびより': ['动画', '流行'], '牛奶咖啡': ['抒情', '流行'],
    '陈粒': ['独立', '摇滚'], '唐磊': ['民谣', '抒情'],
    '谢津': ['经典', '流行'], '大庆小芳': ['民俗', '流行'],
    '刘思涵': ['抒情', '流行'], '金海心': ['抒情', '流行'],
    '李叔同': ['经典', '民歌'], '郑伊健': ['抒情', '流行'],
    'Lia': ['动画', '抒情'], 'Doriko': ['Vocaloid', '抒情'],
    '魏如萱': ['独立', '流行'], '郭静': ['抒情', '流行'],
    '李宗盛': ['抒情', '摇滚'], '周深': ['抒情', '流行'],
    '光良': ['抒情', '流行'], '買辣椒也用券': ['抒情', '流行'],
    '買辣椒也用券': ['抒情', '流行'], '阿肆': ['独立', '流行'],
    '田馥甄': ['抒情', '流行'], '萧敬腾': ['摇滚', '流行'],
    '瑛人': ['摇滚', '流行'],
}

# ═══════ Language-based default tags ═══════
LANG_DEFAULTS = {
    '中文': ['流行'], '日语': ['流行'], '英文': ['流行'],
    '韩语': ['K-Pop', '流行'], '中英混合': ['流行'], '其他': ['流行'],
}

# ═══════ MusicBrainz API ═══════
API_URL = 'https://musicbrainz.org/ws/2/recording/'
HEADERS = {'User-Agent': 'SuiSongList/1.0 (https://github.com/Tsingyun/sui-song-list-new)', 'Accept': 'application/json'}
session = requests.Session()
session.headers.update(HEADERS)

def normalize(s):
    if not s: return ''
    s = unicodedata.normalize('NFKC', s).lower()
    s = s.replace(' ', '').replace('\u3000', '').replace('\xa0', '')
    s = re.sub(r'[（）()【】\[\]《》<>「」\'\"~～·．・\-–—.,，。.!！?？:：;；]', '', s)
    return s

def search_musicbrainz(song_name, artist_name=''):
    """Search MusicBrainz for song tags."""
    query = song_name
    if artist_name:
        query += f' AND artist:{artist_name}'
    try:
        resp = session.get(API_URL, params={'query': query, 'limit': 3, 'fmt': 'json'}, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            recordings = data.get('recordings', [])
            all_tags = set()
            for rec in recordings[:3]:
                # Check tags
                for tag in rec.get('tags', []):
                    all_tags.add(tag['name'].lower())
                # Check genres
                for genre in rec.get('genres', []):
                    all_tags.add(genre['name'].lower())
                # Check artist tags
                for credit in rec.get('artist-credit', []):
                    artist = credit.get('artist', {})
                    for tag in artist.get('tags', []):
                        all_tags.add(tag['name'].lower())
                    for genre in artist.get('genres', []):
                        all_tags.add(genre['name'].lower())
            return all_tags
        elif resp.status_code == 503:
            return None  # Service unavailable
    except Exception as e:
        pass
    return set()

def map_tags_to_chinese(mb_tags):
    """Map MusicBrainz English tags to Chinese genre labels."""
    result = set()
    for tag in mb_tags:
        tag_lower = tag.lower().strip()
        if tag_lower in GENRE_MAP:
            result.add(GENRE_MAP[tag_lower])
    return list(result)

def detect_special_tags(song_name, artist_name):
    """Detect special tags from song name and artist heuristics."""
    tags = set()
    name_lower = song_name.lower() if song_name else ''
    # Anime detection - Japanese titles with specific patterns
    if re.search(r'[\u3040-\u309f\u30a0-\u30ff]', song_name or ''):
        # Many Japanese songs with hiragana/katakana are anime themes or Vocaloid
        pass
    return tags

# ═══════ Main ═══════
with open(DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)
songs = data['songs']

print(f'Total songs: {len(songs)}')
tagged_count = 0
api_count = 0
skipped = 0

for i, song in enumerate(songs):
    name = song['name']
    artist = song.get('artist', '')

    # Skip if already has tags
    if song.get('tags') and len(song['tags']) > 0:
        skipped += 1
        continue

    tags = []

    # Strategy 1: Curated song database
    if name in SONG_TAGS:
        tags = SONG_TAGS[name][:]

    # Strategy 2: Artist-based defaults
    if not tags and artist in ARTIST_TAGS:
        tags = ARTIST_TAGS[artist][:]

    # Strategy 3: MusicBrainz API (only if no curated match)
    if not tags:
        mb_tags = search_musicbrainz(name, artist)
        if mb_tags is not None and len(mb_tags) > 0:
            mapped = map_tags_to_chinese(mb_tags)
            if mapped:
                tags = mapped
                api_count += 1
        time.sleep(1.1)  # Rate limit: 1 request per second

    # Strategy 4: Language-based default
    if not tags:
        lang = song.get('lang', '中文')
        tags = LANG_DEFAULTS.get(lang, ['流行'])[:]

    # Add anime tag for known anime artists if not already present
    anime_artists = {'supercell', 'EGOIST', 'LiSA', 'Aimer', 'Linked Horizon', 'Kalafina',
                     'UNISON SQUARE GARDEN', '神前暁', 'May\'n', 'ヒグチアイ'}
    if artist in anime_artists and '动画' not in tags:
        tags.insert(0, '动画')

    # Add Vocaloid for known producers
    vocaloid_artists = {'40mP', '蝶々P', 'バルーン', 'DECO*27', 'syudou', 'じん', '164',
                        'Giga', 'Mitchie M', 'Orangestar', '*Luna', 'ilem', 'Doriko',
                        'ryo', 'ハチ', 'カンザキイオリ', 'まふまふ'}
    if artist in vocaloid_artists and 'Vocaloid' not in tags:
        tags.insert(0, 'Vocaloid')

    # Limit to max 3 tags
    song['tags'] = tags[:3]
    tagged_count += 1

    if (i + 1) % 50 == 0:
        print(f'  Progress: {i+1}/{len(songs)} songs processed, {tagged_count} tagged, {api_count} from API')

print(f'\n=== Tag Matching Results ===')
print(f'Total songs: {len(songs)}')
print(f'Newly tagged: {tagged_count}')
print(f'From API: {api_count}')
print(f'Skipped (already tagged): {skipped}')

# Count tag distribution
tag_counts = {}
for s in songs:
    for t in s.get('tags', []):
        tag_counts[t] = tag_counts.get(t, 0) + 1

print(f'\nTag distribution:')
for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
    print(f'  {tag}: {count} songs ({count*100//len(songs)}%)')

# Save
with open(DATA_FILE, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f'\nSaved to: {DATA_FILE}')
