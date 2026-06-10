(() => {
  const DATA = window.BEAGLE_GAME_DATA;
  const SAVE_SLOT_PREFIX = "beagle-darwin-note-save-v2-slot-";
  const SAVE_SLOT_COUNT = 5;
  const GALLERY_KEY = "beagle-darwin-endings-v1";
  const GEMINI_MODEL = "gemini-2.5-flash";
  const GEMINI_FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-pro"];
  const AGENT_VERDICT_DELAY_MS = 3200;
  const CHALLENGE_INTRO_MS = 2200;
  const CHALLENGE_COMPLETE_MS = 2500;
  const CHALLENGE_COMPLETE_PING_RATIO = 0.3;
  const AGENT_PASS_SCORE = 80;
  const INTRO_TYPE_INTERVAL_MS = 42;
  const INTRO_KEY_VOLUME = 0.055;
  const SCREEN_TOAST_MS = 2400;
  const START_TRANSITION_MS = 1180;
  const START_SLOT_ANIMATION_MS = 260;
  const START_BGM_DUCK_MS = 320;
  const START_WHOOSH_DELAY_MS = 130;
  const BGM_VOLUME = 0.42;
  const BGM_FADE_MS = 650;
  const FITZROY_TYPO_LINE = "말도 제대로 못 하는데 무슨 항해를 버티겠어.";
  const INTRO_TUTORIAL_PROMPT = "튜토리얼을 보시겠습니까?";
  const TEST_AUDIO_MUTED = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.has("mute") || params.has("muted");
    } catch {
      return false;
    }
  })();
  const app = document.querySelector("#app");
  const VN_BASE_WIDTH = 1280;
  const VN_BASE_HEIGHT = 720;

  let view = "start";
  let state = null;
  let startMessage = "";
  let screenToastMessage = "";
  let screenToastTimer = null;
  let screenToastToken = 0;
  let startSlotMenuOpen = false;
  let startSlotMenuClosing = false;
  let resetConfirmOpen = false;
  let galleryPreviewEndingId = "";
  let introLineIndex = 0;
  let introMode = "story";
  let introText = "";
  let tutorialStepIndex = 0;
  let introTimer = null;
  let effectTimer = null;
  let loadingTimer = null;
  let agentTransitionTimer = null;
  let challengeCompleteTimer = null;
  let challengeExitSoundTimer = null;
  let challengeCompletePingTimer = null;
  let startTransitionTimer = null;
  let startWhooshTimer = null;
  let startSlotTimer = null;
  let timedChoiceTimer = null;
  let timedChoiceTickTimer = null;
  let letterTimer = null;
  let bgmAudio = null;
  let currentBgmKey = "";
  let bgmUnlocked = false;
  let currentBackgroundImage = "";
  let currentCharacterSceneId = "";
  let currentCharacterLayoutKey = "";
  let introAudioContext = null;
  let introSoundEnabled = false;
  const imageCache = new Map();
  let viewportLayoutFrame = 0;

  const INITIAL_PRELOAD_IMAGE_KEYS = ["startHarbor", "harborStudy", "voyageLoading"];

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setCssPx(root, name, value) {
    root.style.setProperty(name, `${Math.round(value * 100) / 100}px`);
  }

  function syncViewportLayoutVars() {
    const root = document.documentElement;
    const width = Math.max(320, window.innerWidth || VN_BASE_WIDTH);
    const height = Math.max(320, window.innerHeight || VN_BASE_HEIGHT);
    const isPortrait = width / height < 1;
    const stageWidth = isPortrait ? width : Math.min(width, height * (16 / 9));
    const stageHeight = isPortrait ? height : Math.min(height, width * (9 / 16));
    const sideGap = Math.max(0, (width - stageWidth) / 2);
    const topGap = Math.max(0, (height - stageHeight) / 2);
    const rawScale = isPortrait ? Math.min(width / 430, height / VN_BASE_HEIGHT) : stageHeight / VN_BASE_HEIGHT;
    const scale = clampNumber(rawScale, 0.76, 1.16);
    const fontScale = clampNumber(rawScale, 0.86, 1.08);
    const edgeX = Math.max(10, sideGap + 18 * scale);
    const edgeY = Math.max(8, topGap + 14 * scale);
    const dialogueBottom = Math.max(10, topGap + 18 * scale);
    const dialogueHeight = clampNumber(128 * scale, 112, 152);
    const dialogueWidth = Math.max(300, Math.min(1320 * scale, width - edgeX * 2));
    const characterWidth = clampNumber(Math.min(stageWidth * 0.3, stageHeight * 0.45), 180, 430);
    const castWidth = clampNumber(Math.min(stageWidth * 0.24, stageHeight * 0.42), 150, 340);
    const topbarReserved = clampNumber((isPortrait ? 92 : 64) * scale, 52, isPortrait ? 116 : 86);
    const uiEdgeX = Math.max(18, 18 * scale);
    const uiEdgeY = Math.max(14, 14 * scale);
    const routeTop = uiEdgeY + clampNumber((isPortrait ? 88 : 46) * scale, isPortrait ? 78 : 42, isPortrait ? 104 : 58);

    root.style.setProperty("--vn-scale", scale.toFixed(3));
    root.style.setProperty("--vn-font-scale", fontScale.toFixed(3));
    setCssPx(root, "--vn-stage-w", stageWidth);
    setCssPx(root, "--vn-stage-h", stageHeight);
    setCssPx(root, "--vn-edge-x", edgeX);
    setCssPx(root, "--vn-edge-y", edgeY);
    setCssPx(root, "--vn-ui-edge-x", uiEdgeX);
    setCssPx(root, "--vn-ui-edge-y", uiEdgeY);
    setCssPx(root, "--vn-route-top", routeTop);
    setCssPx(root, "--vn-dialogue-bottom", dialogueBottom);
    setCssPx(root, "--vn-dialogue-width", dialogueWidth);
    setCssPx(root, "--vn-dialogue-min-h", dialogueHeight);
    setCssPx(root, "--vn-dialogue-pad-y", clampNumber(19 * scale, 13, 22));
    setCssPx(root, "--vn-dialogue-pad-x", clampNumber(24 * scale, 15, 28));
    setCssPx(root, "--vn-dialogue-gap", clampNumber(16 * scale, 8, 18));
    setCssPx(root, "--vn-dialogue-speaker-min", clampNumber(118 * scale, 88, 136));
    setCssPx(root, "--vn-dialogue-speaker-max", clampNumber(178 * scale, 124, 194));
    setCssPx(root, "--vn-choice-top", topGap + stageHeight * 0.46);
    setCssPx(root, "--vn-choice-width", Math.min(760 * scale, width - edgeX * 2));
    setCssPx(root, "--vn-choice-gap", clampNumber(12 * scale, 8, 14));
    setCssPx(root, "--vn-choice-min-h", clampNumber(52 * scale, 42, 58));
    setCssPx(root, "--vn-choice-pad-y", clampNumber(10 * scale, 8, 12));
    setCssPx(root, "--vn-choice-pad-x", clampNumber(18 * scale, 12, 22));
    setCssPx(root, "--vn-character-width", characterWidth);
    setCssPx(root, "--vn-character-right", Math.max(edgeX + 10 * scale, sideGap + stageWidth * 0.11));
    setCssPx(root, "--vn-character-bottom", dialogueBottom + dialogueHeight * 0.82);
    setCssPx(root, "--vn-cast-width", castWidth);
    setCssPx(root, "--vn-cast-left", Math.max(edgeX, sideGap + stageWidth * 0.07));
    setCssPx(root, "--vn-cast-right", Math.max(edgeX, sideGap + stageWidth * 0.07));
    setCssPx(root, "--vn-cast-bottom", dialogueBottom + dialogueHeight * 0.78);
    setCssPx(root, "--vn-hud-top", edgeY + topbarReserved + 16 * scale);
    setCssPx(root, "--vn-hud-side", edgeX);
    setCssPx(root, "--vn-hud-width", Math.min(430 * scale, width - edgeX * 2));
    setCssPx(root, "--vn-toast-bottom", dialogueBottom + dialogueHeight + 18 * scale);
    setCssPx(root, "--vn-agent-width", Math.min(1320 * scale, width - edgeX * 2));
    setCssPx(root, "--vn-agent-bottom", dialogueBottom);
    setCssPx(root, "--vn-agent-height", Math.max(420, height - edgeY - dialogueBottom - 68 * scale));
    setCssPx(root, "--vn-action-min-h", clampNumber(34 * scale, 28, 38));
    setCssPx(root, "--vn-action-pad-x", clampNumber(11 * scale, 7, 13));
    setCssPx(root, "--vn-font-top-meta", 13.12 * fontScale);
    setCssPx(root, "--vn-font-top-title", 21.76 * fontScale);
    setCssPx(root, "--vn-font-action", 13.12 * fontScale);
    setCssPx(root, "--vn-font-dialogue-name", 16.8 * fontScale);
    setCssPx(root, "--vn-font-dialogue-role", 12.48 * fontScale);
    setCssPx(root, "--vn-font-dialogue-line", 18.56 * fontScale);
    setCssPx(root, "--vn-font-small", 12.48 * fontScale);
    setCssPx(root, "--vn-font-choice", 16 * fontScale);
    setCssPx(root, "--vn-font-hud", 16 * fontScale);
    setCssPx(root, "--vn-font-agent-message", 14.72 * fontScale);
    setCssPx(root, "--vn-font-agent-small", 12.16 * fontScale);
  }

  function queueViewportLayoutSync() {
    if (viewportLayoutFrame) cancelAnimationFrame(viewportLayoutFrame);
    viewportLayoutFrame = requestAnimationFrame(() => {
      viewportLayoutFrame = 0;
      syncViewportLayoutVars();
    });
  }
  const tutorialSteps = [
    {
      target: "meta",
      text: "**왼쪽 상단**에는 지금 장면의 연도와 장소가 표시됩니다.\n지금이 언제인지, 다윈이 어디있는지 확인할 수 있습니다.",
    },
    {
      target: "stats",
      text: "**능력치**는 엔딩과 직접 연결됩니다.\n여러분은 다양한 선택을 통해 **과학적 성취도**와 **인류애적 통찰력**을 얻거나, 잃을 수 있습니다.\n따라서 두 능력치를 함께 챙겨야 진엔딩에 도달할 수 있습니다.",
    },
    {
      target: "notes",
      text: "**노트**에는 항해 중 남긴 표본, 사람, 지형, 이론 메모가 쌓입니다.\n여러분은 이를 통해 선택의 흔적을 다시 확인할 수 있습니다.",
    },
    {
      target: "back",
      text: "**뒤로가기** 버튼은 직전 대사나 선택 이전으로 돌아갈 때 사용합니다.\n중요한 선택 전에는 한 번 더 생각해도 좋습니다.",
    },
    {
      target: "save",
      text: "**저장**은 현재 항해를 슬롯에 남깁니다.\n여러 갈래의 결말을 보고 싶다면 장면마다 저장해 두세요.",
    },
    {
      target: "load",
      text: "**불러오기**는 저장한 슬롯으로 돌아갑니다.\n다른 선택지를 시험해 보고 싶을 때 유용합니다.",
    },
    {
      target: "exit",
      text: "**나가기**는 시작 화면으로 돌아갑니다.\n저장하지 않은 진행은 사라질 수 있으니 조심하세요.",
    },
    {
      target: "final",
      text: "다윈이 역사에 획을 긋는 진화론자가 될 수 있도록 하기 위해서는 여러분의 도움이 필요합니다.",
    },
  ];

  const sceneById = new Map(DATA.scenes.map((scene) => [scene.id, scene]));
  const playableScenes = DATA.scenes;
  const agentSceneConfigs = {
    "shrewsbury-family": {
      targetName: "로버트 다윈",
      targetLabel: "아버지",
      playerLabel: "찰스",
      maxTurns: 8,
      nextScene: "fitzroy-interview",
      badEndingId: "familyFailure",
      challengeTitle: "아버지의 허락을 받자",
      successEffects: {},
      failureEffects: {},
      backgrounds: { bad: "agentFatherBad", good: "agentFatherGood" },
      opening:
        "찰스, 그 항해가 네 장래에 무슨 도움이 된다고 생각하는지 네 생각이 궁금하구나. 말해봐라.",
      role:
        "당신은 찰스 다윈의 아버지 로버트 다윈이다. 이미 조시아 웨지우드의 편지를 읽었고, 항해가 완전히 무모한 방랑만은 아닐 수 있다는 점도 알고 있다. 그래도 최종 결정에는 찰스 본인의 의지와 책임감이 중요하다고 생각한다. 말투는 엄하지만 가족 안에서 걱정하는 아버지처럼 자연스럽고 감정적으로 대화한다. 논문 심사나 면접처럼 말하지 말고, 짧고 생활감 있는 말로 반응한다. 안전한 귀환 약속, 항해가 헛된 방황이 아니라 배움이 될 수 있다는 말, 가족을 실망시키지 않겠다는 태도에 호감도가 오른다. 통과 응답은 편지와 찰스의 의지를 함께 확인했으므로 항해를 허락한다는 뉘앙스로 말한다.",
    },
    "fitzroy-interview": {
      targetName: "로버트 피츠로이",
      targetLabel: "선장",
      playerLabel: "다윈",
      maxTurns: 8,
      nextScene: "brazil",
      badEndingId: "noseReject",
      challengeTitle: "관상학을 사랑하는 남자",
      successEffects: {},
      failureEffects: { scienceEthics: -1 },
      backgrounds: { bad: "agentFitzroyBad", good: "agentFitzroyGood" },
      opening:
        "흠... 자네 코가 너무 큰데. 이런 얼굴로 긴 항해를 버티고 내 배에서 똑바로 할 수 있겠나?",
      role:
        "당신은 HMS Beagle의 선장 로버트 피츠로이다. 말투는 까칠하고 단호하지만, 게임 속 인물처럼 짧고 생동감 있게 반응한다. 학술 면접관처럼 길게 설명하지 말고, 선장다운 농담, 의심, 압박, 짧은 칭찬을 섞어 대화한다. 외모 판단에 기대는 시대적 편견이 있지만, 다윈이 무례하게 폭발하지 않고 '실력으로 보이겠다', '배의 규율을 따르겠다', '관찰 기록을 성실히 남기겠다', '선원들과 협력하겠다'는 식으로 답하면 마음이 움직인다. 플레이어 발언에 명백한 오타, 자음/모음만 있는 말, 뜻을 알아듣기 어려운 말이 있으면 '말도 제대로 못 하는데 무슨 항해를 버티겠어.'와 비슷한 대사를 반드시 하고 호감도를 내린다. 통과 응답은 (잠시 다윈의 얼굴을 뚫어져라 본다)를 출력한 이후 다음 대사로 '자네의 태도를 보겠네.'라고 허락하는 식으로 말한다.",
    },
  };
  const speakerMeta = {
    "edinburgh-medicine": {
      name: "찰스 다윈",
      role: "에든버러 의학 수업 후",
      portrait: "darwin",
      line: "정말 의학공부를 계속해야 하는 걸까?",
    },
    "edinburgh-medicine-retry": {
      name: "찰스 다윈",
      role: "에든버러 의학 수업 후",
      portrait: "darwin",
      line: "인생은 한 번인데, 나는 정말 내과의사를 하는 게 맞을까?",
    },
    "cambridge-beetles": {
      name: "찰스 다윈",
      role: "케임브리지 들판",
      portrait: "darwin",
      line: "저 작은 딱정벌레도 서로 다른데, 나는 우리 집안과는 다른 것 같아...",
    },
    "shrewsbury-family": {
      name: "로버트 다윈",
      role: "아버지",
      portrait: "father",
      line: "찰스, 그 항해가 네 장래에 무슨 도움이 된다고 생각하는지 네 생각이 궁금하구나. 말해봐라.",
    },
    "fitzroy-interview": {
      name: "로버트 피츠로이",
      role: "비글호 선장",
      portrait: "fitzroy",
      line: "흠... 자네 코가 너무 큰데. 이런 얼굴로 긴 항해를 버티고, 내 배에서 똑바로 할 수 있겠나?",
    },
    brazil: {
      name: "브라질의 노동자",
      role: "항구와 농장 사이",
      portrait: "brazil",
      line: "당신은 무엇을 기록하려는 거지?",
    },
    "tierra-del-fuego": {
      name: "오륜델리코",
      role: "티에라델푸에고의 귀환자",
      portrait: "orundellico",
      line: "당신은 내 이야기를 어떻게 기록할 거지?",
    },
    galapagos: {
      name: "찰스 다윈",
      role: "갈라파고스 표본대",
      portrait: "darwin",
      line: "이제 어떻게 정리해야 하지?",
    },
    "galapagos-finches": {
      name: "찰스 다윈",
      role: "갈라파고스 표본대",
      portrait: "darwin",
      line: "먹이 때문일까, 날씨 때문일까, 아니면 아예 다른 종인 걸까?",
    },
    cocos: {
      name: "찰스 다윈",
      role: "코코스 제도",
      portrait: "darwin",
      line: "현재의 풍경 속 산호초의 모양은 시간이 흐르면서, 가라앉는 섬과 자라는 산호로 만들어졌다.",
    },
    "return-storm-event": {
      name: "찰스 다윈",
      role: "영국으로 돌아가는 비글호",
      portrait: "darwin",
      line: "시간이 없다. 무엇부터 챙겨야 하지?",
    },
    "tahiti-network": {
      name: "찰스 다윈",
      role: "타히티와 뉴질랜드의 항구",
      portrait: "darwin",
      line: "이 풍경을 그냥 지나쳐도 되는 걸까?",
    },
    "london-malthus": {
      name: "찰스 다윈",
      role: "런던의 서재",
      portrait: "darwin",
      line: "자원이 한정적인 자연에서 강자가 살아남고 약자는 도태된다고?",
    },
    "wallace-letter": {
      name: "알프레드 러셀 월리스",
      role: "편지 속 동료 자연학자",
      portrait: "wallace",
      line: "다윈 씨, 저도 비슷한 생각에 도달했습니다. 이 발견을 우리는 어떻게 다루어야 할까요?",
    },
    "publish-origin": {
      name: "찰스 다윈",
      role: "다운 하우스의 원고 앞",
      portrait: "darwin",
      line: "이제 이 기록을 세상에 보여줄 시간이다.",
    },
  };

  const choiceReplies = {
    "choose-medicine": "그래도 해야지...",
    "choose-natural-history": "생물이 더 마음에 드는 것 같기도...",
    "quit-school-father": "아버지께 그만둔다고 말씀드린다.",
    "doctor-ending-early": "그래도 아버지 말대로 의학공부에 열중하자.",
    "anatomy-tantrum": "해부학 무섭다고 떼쓰자.",
    "beetle-focus": "딱정벌레 표본 연구를 하고 싶어.",
    "theologian-ending": "아버지 말대로 신학공부에 열중하자.",
    "ask-help-seasick": "주변 사람들에게 도움을 요청한다.",
    "jump-overboard": "뛰어내린다.",
    "ask-captain-seasick": "선장에게 말한다.",
    "ask-mate-seasick": "부선장에게 말한다.",
    "ask-sailor-tonic": "선원에게 말한다.",
    "listen-enslaved": "자연과 함께 노예도 기록한다.",
    "ignore-slavery": "나는 자연을 보러 온 거야. 사람들은 관심없어.",
    "respectful-dialogue": "당신의 말을 존중하겠습니다.",
    "civilization-scale": "그냥 유럽식 기준에 맞추겠습니다.",
    "tag-islands": "섬 이름, 날짜, 생김새 등 표본마다 자세하게 기록해야지.",
    "mix-tags": "이제 상자도 넘치고, 그냥 다 비슷해보이는데...... 대충 넣자.",
    "finch-food": "먹이가 다른걸까?",
    "finch-weather": "날씨가 다른걸까?",
    "finch-different-species": "아예 다른 종인걸까?",
    "model-coral": "지금 보이는 모양에서 형성 과정을 거꾸로 추론해봐야지.",
    "sail-past": "항해에 위험이 되는 암초 위치만 기록해야지.",
    "storm-save-specimens": "표본 상자와 항해 지도와 기록",
    "storm-help-crew": "갑판 위 선원들",
    "storm-personal-luggage": "개인 짐",
    "network-critique": "타히티 섬에서의 불평등도 기록해야지.",
    "mission-only": "선교가 곧 진리다.",
    "cruel-reading": "사람의 사회와 자연을 같은 방식으로 볼 수 있을까..?",
    "careful-malthus": "비관적이긴 한데, 자연과 연결해 생각해볼까..",
    "joint-presentation": "월리스의 기여를 인정하고 공동 발표를 해야겠다.",
    "hide-wallace": "이 편지는 아무도 못 본 거야...",
    "publish": "원고를 다듬어 공동 발표를 해야겠다.",
    "stay-unfinished": "아직 부족한 것 같다. 원고는 미뤄두자.",
  };

  const choiceOutcomes = {
    "choose-medicine": "그래... 그래도 해야지. 다윈은 마음 한구석의 찝찝함을 덮어 둔다.",
    "choose-natural-history": "'아버지께 의학공부를 하고 싶지 않다고 말씀드려야지'",
    "beetle-focus": "딱정벌레 한 마리에도 장소에 따라 차이가 보이기 시작했다.",
    "doctor-ending-early": "다윈은 관찰 노트를 닫는다. 자연사의 길은 아직 열리지 못한 채 의학 책상으로 돌아간다.",
    "theologian-ending": "하나님 저에게 왜 이런 시련을 주시나이까",
    "ask-help-seasick": "다윈은 난간을 붙잡고 사람을 찾아 나선다. 혼자 버티기에는 바다가 너무 사납다.",
    "jump-overboard": "다윈은 순간적으로 바다 쪽을 바라본다. 그 선택은 항해를 끝내기에는 너무 빠르고, 너무 차갑다.",
    "ask-captain-seasick": [
      "역시 선장님께 말씀드려야겠지?", 
      "피츠로이는 다윈을 짧게 보고 말한다.",
      "\"코부터 마음에 안 들었어. 내려.\""
    ],
    "ask-mate-seasick": [
      "선장님은 좀 무서우니 부선장에게 말하자.", 
      "하지만 돌아온 말은 차갑다.",
      "\"지금 파도 심한 거 안 보이십니까? 말 걸지 마세요!\""
    ],
    "ask-sailor-tonic": [
      "선원이 작은 병을 내민다.",
      "제가 숨겨놓은 보약을 드리겠습니다.",
      "어쩐지 마음이 편안해진다.",
    ],
    "listen-enslaved": [
      "\"아름다운 자연을 기록하는 눈이 사람의 고통을 외면한다면 그 노트는 반쪽짜리야..!\"",
      "브라질의 숲은 더 이상 아름다운 풍경만으로 남지 않는다. 그 이면에 위치한 노예제의 폭력성도 기록된다."
    ],
    "ignore-slavery": "다윈의 시선은 숲으로 달아난다. 그러나 외면한 항구의 소음은 노트 밖에서 계속 울린다.",
    "respectful-dialogue": [
      "오륜델리코는 짧게 고개를 끄덕인다. 다윈의 노트는 낯섦을 열등함으로 번역하지 않으려 애쓴다.",
      "티에라델푸에고에서 다윈은 오륜델리코와의 대화를 토대로, 선교, 언어, 정체성이 얽힌 만남을 기록했다."],
    "civilization-scale": [
      {
        text: "어라, 제미 버튼이 으슥한 곳으로 나를 부른다.",
        cast: [
          { id: "orundellico", portrait: "orundellico", side: "left" },
          { id: "darwin", portrait: "darwin", side: "right", flipped: true },
        ],
      },
      {
        speaker: "darwin",
        name: "찰스 다윈",
        role: "티에라델푸에고",
        text: "제미 버튼? 어디 있어?",
        cast: [
          { id: "orundellico", portrait: "orundellico", side: "left" },
          { id: "darwin", portrait: "darwin", side: "right", flipped: true },
        ],
      },
      {
        speaker: "orundellico",
        name: "오륜델리코",
        role: "제미 버튼",
        text: "당신 같은 사람은 이제 질렸어.",
        cast: [
          { id: "orundellico", portrait: "orundellico", side: "left" },
          { id: "darwin", portrait: "darwin", side: "right", flipped: true },
        ],
      },
      {
        speaker: "darwin",
        name: "찰스 다윈",
        role: "티에라델푸에고",
        text: "안돼.. 무사히 돌아가기로 했는데..",
        cast: [
          { id: "orundellico", portrait: "orundellico", side: "left" },
          { id: "darwin", portrait: "darwin", side: "right", flipped: true },
        ],
      },
    ],
    "tag-islands": {
      text: "다윈은 각 표본에 섬 이름을 붙였다.",
      note: "실제로 다윈은 핀치새를 분류하지 않았으며, 후에 존 굴드(John Gould)에 의해 분류되어 같은 종임이 밝혀졌습니다.",
    },
    "reflect-galapagos": "다윈은 잠깐 고민하다가 각 표본에 섬 이름을 붙였다.",
    "mix-tags": "상자 속 표본들이 뒤섞인다. 섬마다 달랐던 작은 차이는 더 이상 또렷하게 말하지 못한다.",
    "finch-food": "훗날 섬간 종의 차이를 비교하는데 단서가 되었다.",
    "finch-weather": "피츠로이: \"자네는 이런것도 분석을 못하는군. 역시 코가 이상하다 했어.\"",
    "finch-different-species": "피츠로이: \"자네는 이런것도 분석을 못하는군. 역시 코가 이상하다 했어.\"",
    "model-coral": "다윈은 현재의 산호초를 통해 보이지 않는 시간의 흐름의 중요성을 깨닫는다.",
    "sail-past": "암초의 위치는 남았지만, 그것이 어떻게 만들어졌는지는 항해 기록의 여백으로 밀린다.",
    "storm-save-specimens": "다윈은 흔들리는 선실로 뛰어들어 표본 상자와 항해 지도, 기록을 끌어안았다. 훗날 연구의 실마리가 젖지 않고 살아남았다.",
    "storm-help-crew": "다윈은 갑판으로 달려가 밧줄을 붙잡은 선원들을 도왔다. 폭풍 속에서 사람을 먼저 본 기록이 마음에 남았다.",
    "storm-personal-luggage": "다윈은 개인 짐부터 붙잡았다. 그 사이 표본과 기록은 흩어지고, 갑판 위의 고함은 멀어졌다.",
    "network-critique": [
      "선교사, 선원, 정착민, 현지인이 같은 항구에 있다.",
      "하지만 같은 힘을 가진 것은 아니다.",
      "난 이 길의 불평등을 기록할 것이다."
    ],
    "mission-only": "현지 사회의 목소리는 사라지고, 선교사의 문장만 노트 위에 남는다.",
    "careful-malthus": "다윈은 문장에 밑줄을 긋고, 진화론에 아이디어를 추가한다.",
    "cruel-reading": [
      "다윈은 사람의 사회와 자연을 같은 방식으로 볼 수 있을지 망설이다가 책을 덮는다.",
      "표본은 많지만, 변이와 환경 압력을 묶어 줄 생각은 아직 떠오르지 않는다.",
      "'내가 대체 뭘 놓친거지..'"
    ],
    "joint-presentation": "월리스의 기여를 무시할 순 없다. 다윈은 자기 이론과 함께 월리스의 기여도 세상에 발표하기로 한다.",
    "hide-wallace": "편지는 어둡게 접힌다. 그러나 접힌 종이만큼 다윈의 연구 윤리도 함께 구겨진다.",
    "publish": "다윈은 원고를 다시 다듬는다. 이제 관찰한 내용은 사적인 노트를 넘어 공동 발표와 공개된 논쟁으로 향한다.",
    "stay-unfinished": "원고는 다시 서랍으로 들어간다. 충분한 증거가 있어도 발표하지 못하면 이론은 세상에 닿지 못한다.",
  };

  const reflectChoiceLabels = {
    "edinburgh-medicine": "잠깐, 내가 정말 원하는 공부가 뭔지 더 생각한다.",
    "cambridge-beetles": "신학 책을 덮고 들판의 생물을 더 관찰한다.",
    "brazil": "잠깐 멈춰, 이 풍경을 누가 지탱하는지 살핀다.",
    "tierra-del-fuego": "잠깐 멈춰, 낯선 이름과 말을 먼저 듣는다.",
    "galapagos": "고민해본다..",
    "cocos": "좀 더 생각해봐야겠다.",
    "tahiti-network": "기록할까, 말까.",
    "london-malthus": "좀 더 생각해본다.",
    "wallace-letter": "월리스..?",
  };
  const reflectChoiceOverrides = {
    "edinburgh-medicine": {
      effects: { naturalHistory: 1, observation: 1 },
      addNotes: ["theory|진로 고민: 의학의 의무감보다 자연을 관찰하려는 마음이 더 또렷해졌다."],
      outcome: "다윈은 의학 책 위에 손을 얹고 오래 망설인다. 답은 아직 작지만, 마음은 자연사 쪽으로 기울기 시작했다.",
      nextScene: "edinburgh-medicine-retry",
    },
    "cambridge-beetles": {
      effects: { naturalHistory: 1, observation: 1 },
      addNotes: ["specimens|케임브리지 들판: 신학 공부 사이에서도 작은 생물의 차이를 계속 살폈다."],
      outcome: "다윈은 신학 책을 잠시 덮고 들판으로 나갔다. 딱정벌레의 작은 차이가 다시 눈에 들어왔다.",
    },
    brazil: {
      effects: { respect: 1, empireCritique: 1 },
      addNotes: ["ethics|브라질의 항구: 아름다운 자연 뒤에 놓인 노동과 폭력의 구조를 함께 보려 했다."],
      outcome: "다윈은 숲의 아름다움만 기록하려다 멈춘다. 항구의 소리와 사람들의 표정도 노트 밖으로 밀어낼 수 없었다.",
    },
    "tierra-del-fuego": {
      effects: { respect: 1, empireCritique: 1 },
      addNotes: ["ethics|이름과 목소리: 낯선 삶을 유럽식 기준으로 바로 재단하지 않으려 했다."],
      outcome: "다윈은 바로 분류하려던 손을 멈추고, 먼저 이름과 말을 듣기로 한다.",
    },
    galapagos: {
      effects: { observation: 1 },
    },
    cocos: {
      effects: { observation: 1 },
    },
    "tahiti-network": {
      effects: { respect: 1 },
    },
    "london-malthus": {
      effects: { theory: 1 },
    },
    "wallace-letter": {
      effects: { scienceEthics: -3 },
    },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function classToken(value) {
    return String(value || "").replace(/[^a-z0-9_-]/gi, "-");
  }

  function cssAssetUrl(value) {
    const source = String(value || "");
    if (/^(?:[a-z]+:|\/)/i.test(source)) return source;
    return `../${source.replace(/^\.?\//, "")}`;
  }

  function formatTutorialText(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  function formatLetterBody(lines) {
    const source = (Array.isArray(lines) ? lines.join("\n") : String(lines || ""))
      .replace(/\\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return escapeHtml(source);
  }

  function getLetterPages(lines) {
    const source = Array.isArray(lines) ? lines : String(lines || "").split("\n");
    const splitIndex = source.findIndex((line) => String(line).includes("필요가 없겠지요"));
    if (splitIndex < 0) return [source];
    return [source.slice(0, splitIndex + 1), source.slice(splitIndex + 1)].filter((page) =>
      page.some((line) => String(line).trim()),
    );
  }

  function scheduleIdleTask(callback, timeout = 1500) {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(callback, { timeout });
      return;
    }
    window.setTimeout(callback, Math.min(timeout, 900));
  }

  function preloadImage(src, priority = "auto") {
    if (!src || imageCache.has(src) || typeof Image === "undefined") return;
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.src = src;
    imageCache.set(src, image);
    image.decode?.().catch(() => {});
  }

  function preloadImages() {
    const initialSources = INITIAL_PRELOAD_IMAGE_KEYS.map((key) => DATA.images?.[key]).filter(Boolean);
    initialSources.forEach((src) => preloadImage(src, "high"));

    const queuedSources = Object.values(DATA.images || {}).filter((src) => src && !initialSources.includes(src));
    let index = 0;
    const preloadNext = () => {
      const src = queuedSources[index];
      index += 1;
      if (!src) return;
      preloadImage(src);
      scheduleIdleTask(preloadNext, 1800);
    };
    scheduleIdleTask(preloadNext, 2200);
  }

  function preloadSceneAssets(scene) {
    if (!scene) return;
    preloadImage(DATA.images[scene.background]);
    (scene.backgroundChanges || []).forEach((change) => preloadImage(DATA.images[change.background]));
    (scene.choices || []).forEach((choice) => {
      preloadImage(DATA.images[choice.outcomeBackground]);
      if (choice.nextScene && choice.nextScene !== "__final__") {
        const nextScene = sceneById.get(choice.nextScene);
        preloadImage(DATA.images[nextScene?.background]);
      }
    });
    if (scene.next && scene.next !== "__final__") {
      preloadImage(DATA.images[sceneById.get(scene.next)?.background]);
    }
  }

  function resolveSceneId(sceneId) {
    return sceneById.has(sceneId) ? sceneId : playableScenes[0]?.id || DATA.scenes[0].id;
  }

  function getGalleryEndings() {
    return Object.entries(DATA.endings);
  }

  function getSaveSlotKey(slot) {
    return `${SAVE_SLOT_PREFIX}${slot}`;
  }

  function clearScreenToastTimer() {
    if (!screenToastTimer) return;
    clearTimeout(screenToastTimer);
    screenToastTimer = null;
  }

  function renderScreenToast() {
    if (!screenToastMessage) return "";
    return `<p class="screen-toast" role="status">${escapeHtml(screenToastMessage)}</p>`;
  }

  function showScreenToast(message) {
    screenToastMessage = message;
    screenToastToken += 1;
    const token = screenToastToken;
    clearScreenToastTimer();
    screenToastTimer = setTimeout(() => {
      if (screenToastToken !== token) return;
      screenToastMessage = "";
      screenToastTimer = null;
      render();
    }, SCREEN_TOAST_MS);
    render();
  }

  function getSaveSlot(slot) {
    try {
      const raw = localStorage.getItem(getSaveSlotKey(slot));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getSaveSlots() {
    return Array.from({ length: SAVE_SLOT_COUNT }, (_, index) => {
      const slot = index + 1;
      return { slot, data: getSaveSlot(slot) };
    });
  }

  function clearSaveSlots() {
    for (let slot = 1; slot <= SAVE_SLOT_COUNT; slot += 1) {
      localStorage.removeItem(getSaveSlotKey(slot));
    }
  }

  function getLatestSaveSlot() {
    return getSaveSlots()
      .filter((item) => item.data)
      .sort((a, b) => new Date(b.data.savedAt || 0) - new Date(a.data.savedAt || 0))[0] || null;
  }

  function formatSaveSlot(data) {
    if (!data) {
      return { primary: "빈 슬롯", secondary: "저장된 항해가 없습니다." };
    }
    if (data.view === "ending" && data.endingId) {
      const ending = DATA.endings[data.endingId];
      return {
        primary: "엔딩",
        secondary: ending?.title || "완료된 항해",
      };
    }
    const scene = sceneById.get(resolveSceneId(data.sceneId));
    return {
      primary: `${scene?.year || "----"} · ${scene?.location || "알 수 없음"}`,
      secondary: scene?.title || "저장된 항해",
    };
  }

  function formatEndingKind(ending) {
    const prefix = String(ending?.title || "")
      .split(":")[0]
      .trim();
    return (prefix || "엔딩")
      .replace(/엔딩/g, " 엔딩")
      .replace(/\s+/g, " ")
      .trim();
  }

  function formatEndingTitle(ending) {
    return String(ending?.title || "")
      .replace(/^[^:：]+[:：]\s*/, "")
      .trim();
  }

  function getPlayableProgress(sceneId) {
    const resolvedSceneId = resolveSceneId(sceneId);
    const index = playableScenes.findIndex((scene) => scene.id === resolvedSceneId);
    return index < 0 ? 0 : index;
  }

  function baseNotes() {
    return DATA.noteTabs.reduce((notes, tab) => {
      notes[tab.id] = [];
      return notes;
    }, {});
  }

  function normalizeState(loaded) {
    const normalized = {
      view: "game",
      sceneId: DATA.scenes[0].id,
      stats: clone(DATA.initialStats),
      notes: baseNotes(),
      visitedScenes: [],
      noteTab: "specimens",
      lineIndex: 0,
      showStats: false,
      showNotes: false,
      showLetter: false,
      letterPage: 0,
      effectToast: "",
      choiceOutcome: null,
      pendingTransition: null,
      loadingTransition: null,
      challengeComplete: null,
      agentChats: {},
      agentDrafts: {},
      backStack: [],
      choiceOrders: {},
      saveSlotMode: "",
      activeSlot: null,
      mood: "neutral",
      endingId: null,
      flash: "",
      ...loaded,
    };

    normalized.stats = { ...clone(DATA.initialStats), ...(loaded?.stats || {}) };
    normalized.notes = { ...baseNotes(), ...(loaded?.notes || {}) };
    normalized.visitedScenes = Array.isArray(normalized.visitedScenes) ? normalized.visitedScenes : [];
    normalized.backStack = Array.isArray(normalized.backStack) ? normalized.backStack : [];
    normalized.choiceOrders = normalized.choiceOrders && typeof normalized.choiceOrders === "object" ? normalized.choiceOrders : {};
    normalized.agentChats = normalized.agentChats || {};
    normalized.agentDrafts = normalized.agentDrafts || {};
    Object.values(normalized.agentChats).forEach((chat) => {
      if (chat) chat.pending = false;
    });
    normalized.loadingTransition = null;
    normalized.challengeComplete = null;
    normalized.lineIndex = Number.isFinite(normalized.lineIndex) ? normalized.lineIndex : 0;
    normalized.showStats = Boolean(normalized.showStats);
    normalized.showNotes = Boolean(normalized.showNotes);
    normalized.showLetter = Boolean(normalized.showLetter);
    normalized.letterPage = Number.isInteger(normalized.letterPage) ? Math.max(0, normalized.letterPage) : 0;
    normalized.effectToast = normalized.effectToast || "";
    normalized.choiceOutcome = normalized.choiceOutcome || null;
    normalized.pendingTransition = normalized.pendingTransition || null;
    normalized.timedChoiceSceneId = "";
    normalized.timedChoiceDeadline = 0;
    normalized.timedChoiceRemaining = 0;
    normalized.saveSlotMode = normalized.saveSlotMode || "";
    normalized.activeSlot = Number.isInteger(normalized.activeSlot) ? normalized.activeSlot : null;
    normalized.noteTab = DATA.noteTabs.some((tab) => tab.id === normalized.noteTab)
      ? normalized.noteTab
      : "specimens";
    normalized.sceneId = resolveSceneId(normalized.sceneId);
    normalized.mood = normalized.mood || sceneById.get(normalized.sceneId)?.portrait || "neutral";
    return normalized;
  }

  function getUnlockedEndings() {
    try {
      return JSON.parse(localStorage.getItem(GALLERY_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function unlockEnding(endingId) {
    const unlocked = getUnlockedEndings();
    unlocked[endingId] = {
      unlockedAt: new Date().toISOString(),
      title: DATA.endings[endingId]?.title || endingId,
    };
    localStorage.setItem(GALLERY_KEY, JSON.stringify(unlocked));
  }

  function addNotes(addNotes = []) {
    for (const rawNote of addNotes) {
      const [maybeCategory, ...rest] = String(rawNote).split("|");
      const category = DATA.noteTabs.some((tab) => tab.id === maybeCategory) ? maybeCategory : "theory";
      const text = rest.length ? rest.join("|") : rawNote;
      if (!state.notes[category].includes(text)) {
        state.notes[category].push(text);
      }
    }
  }

  function applyEffects(effects = {}) {
    Object.entries(effects).forEach(([key, amount]) => {
      if (!Object.prototype.hasOwnProperty.call(state.stats, key)) {
        state.stats[key] = 0;
      }
      state.stats[key] = Math.max(-9, Math.min(99, state.stats[key] + Number(amount || 0)));
    });
  }

  function clearIntroTimer() {
    if (introTimer) {
      clearInterval(introTimer);
      introTimer = null;
    }
  }

  function clearStartTransitionTimer() {
    if (startTransitionTimer) {
      clearTimeout(startTransitionTimer);
      startTransitionTimer = null;
    }
    if (startWhooshTimer) {
      clearTimeout(startWhooshTimer);
      startWhooshTimer = null;
    }
  }

  function clearStartSlotTimer() {
    if (startSlotTimer) {
      clearTimeout(startSlotTimer);
      startSlotTimer = null;
    }
  }

  function openStartSlots() {
    clearStartSlotTimer();
    startSlotMenuOpen = true;
    startSlotMenuClosing = false;
    renderStart();
  }

  function closeStartSlots(options = {}) {
    clearStartSlotTimer();
    const onClosed = typeof options.onClosed === "function" ? options.onClosed : null;
    if (!startSlotMenuOpen && !startSlotMenuClosing) {
      if (onClosed) onClosed();
      return;
    }
    if (options.immediate) {
      startSlotMenuOpen = false;
      startSlotMenuClosing = false;
      if (options.render !== false) renderStart();
      if (onClosed) onClosed();
      return;
    }
    startSlotMenuOpen = true;
    startSlotMenuClosing = true;
    renderStart();
    startSlotTimer = setTimeout(() => {
      startSlotTimer = null;
      startSlotMenuOpen = false;
      startSlotMenuClosing = false;
      renderStart();
      if (onClosed) onClosed();
    }, START_SLOT_ANIMATION_MS);
  }

  function clearTimedChoiceTimers() {
    if (timedChoiceTimer) {
      clearTimeout(timedChoiceTimer);
      timedChoiceTimer = null;
    }
    if (timedChoiceTickTimer) {
      clearInterval(timedChoiceTickTimer);
      timedChoiceTickTimer = null;
    }
  }

  function clearLetterTimer() {
    if (letterTimer) {
      clearTimeout(letterTimer);
      letterTimer = null;
    }
  }

  function clearChallengeCompleteTimer(resetIntroState = true) {
    if (challengeCompleteTimer) {
      clearTimeout(challengeCompleteTimer);
      challengeCompleteTimer = null;
    }
    if (challengeExitSoundTimer) {
      clearTimeout(challengeExitSoundTimer);
      challengeExitSoundTimer = null;
    }
    if (challengeCompletePingTimer) {
      clearTimeout(challengeCompletePingTimer);
      challengeCompletePingTimer = null;
    }
    if (state) state.challengeComplete = null;
    if (!resetIntroState) return;
    Object.values(state?.agentChats || {}).forEach((chat) => {
      if (chat?.challengeIntroStarted && !chat.challengeIntroDone) {
        chat.challengeIntroStarted = false;
      }
    });
  }

  function unlockIntroSound() {
    if (TEST_AUDIO_MUTED) {
      introSoundEnabled = false;
      return;
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      introAudioContext = introAudioContext || new AudioContextClass();
      introAudioContext.resume?.();
      introSoundEnabled = true;
    } catch {
      introSoundEnabled = false;
    }
  }

  function playIntroKeySound(char) {
    if (TEST_AUDIO_MUTED) return;
    if (!introSoundEnabled || !introAudioContext || !char || /\s/.test(char)) return;
    try {
      const now = introAudioContext.currentTime;
      const sampleRate = introAudioContext.sampleRate || 44100;
      const duration = 0.026 + Math.random() * 0.012;
      const frameCount = Math.max(1, Math.floor(sampleRate * duration));
      const buffer = introAudioContext.createBuffer(1, frameCount, sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < frameCount; index += 1) {
        const decay = 1 - index / frameCount;
        data[index] = (Math.random() * 2 - 1) * decay * decay;
      }
      const source = introAudioContext.createBufferSource();
      const filter = introAudioContext.createBiquadFilter();
      const gain = introAudioContext.createGain();

      source.buffer = buffer;
      filter.type = "highpass";
      filter.frequency.setValueAtTime(850 + Math.random() * 250, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(INTRO_KEY_VOLUME, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(introAudioContext.destination);
      source.start(now);
      source.stop(now + duration);
    } catch {
      introSoundEnabled = false;
    }
  }

  function playStartWhooshSound() {
    if (TEST_AUDIO_MUTED) return;
    if (!introSoundEnabled || !introAudioContext) return;
    try {
      const context = introAudioContext;
      const now = context.currentTime;
      const duration = 1.04;
      const sampleRate = context.sampleRate;
      const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);

      for (let index = 0; index < data.length; index += 1) {
        const progress = index / data.length;
        const swell = Math.sin(progress * Math.PI);
        data[index] = (Math.random() * 2 - 1) * swell * (0.35 + progress * 0.65);
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const lowTone = context.createOscillator();
      const lowGain = context.createGain();

      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(360, now);
      filter.frequency.exponentialRampToValueAtTime(2600, now + duration * 0.72);
      filter.Q.setValueAtTime(0.9, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.17, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      lowTone.type = "sine";
      lowTone.frequency.setValueAtTime(140, now);
      lowTone.frequency.exponentialRampToValueAtTime(54, now + duration);
      lowGain.gain.setValueAtTime(0.001, now);
      lowGain.gain.exponentialRampToValueAtTime(0.045, now + 0.1);
      lowGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      lowTone.connect(lowGain);
      lowGain.connect(context.destination);

      source.start(now);
      lowTone.start(now);
      source.stop(now + duration);
      lowTone.stop(now + duration);
    } catch {
      introSoundEnabled = false;
    }
  }

  function scheduleChallengeExitSound(durationMs) {
    if (challengeExitSoundTimer) {
      clearTimeout(challengeExitSoundTimer);
      challengeExitSoundTimer = null;
    }
    challengeExitSoundTimer = setTimeout(() => {
      challengeExitSoundTimer = null;
      playChallengeCompleteSound("exit");
    }, Math.max(0, durationMs - 430));
  }

  function scheduleChallengeCompletePingSound(durationMs) {
    if (challengeCompletePingTimer) {
      clearTimeout(challengeCompletePingTimer);
      challengeCompletePingTimer = null;
    }
    challengeCompletePingTimer = setTimeout(() => {
      challengeCompletePingTimer = null;
      playChallengePingSound();
    }, Math.max(0, durationMs * CHALLENGE_COMPLETE_PING_RATIO));
  }

  function playChallengePingSound() {
    if (TEST_AUDIO_MUTED) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      introAudioContext = introAudioContext || new AudioContextClass();
      introAudioContext.resume?.();
      const context = introAudioContext;
      const now = context.currentTime;
      const master = context.createGain();
      const tone = context.createOscillator();
      const toneGain = context.createGain();
      const shine = context.createOscillator();
      const shineGain = context.createGain();

      master.gain.setValueAtTime(0.001, now);
      master.gain.exponentialRampToValueAtTime(0.95, now + 0.012);
      master.gain.exponentialRampToValueAtTime(0.001, now + 0.64);

      tone.type = "sine";
      tone.frequency.setValueAtTime(1760, now);
      tone.frequency.setValueAtTime(1760, now + 0.14);
      tone.frequency.exponentialRampToValueAtTime(1480, now + 0.58);
      toneGain.gain.setValueAtTime(0.001, now);
      toneGain.gain.exponentialRampToValueAtTime(0.18, now + 0.014);
      toneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);

      shine.type = "sine";
      shine.frequency.setValueAtTime(3520, now + 0.018);
      shineGain.gain.setValueAtTime(0.001, now + 0.012);
      shineGain.gain.exponentialRampToValueAtTime(0.04, now + 0.03);
      shineGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

      tone.connect(toneGain);
      shine.connect(shineGain);
      toneGain.connect(master);
      shineGain.connect(master);
      master.connect(context.destination);

      tone.start(now);
      shine.start(now + 0.018);
      tone.stop(now + 0.66);
      shine.stop(now + 0.32);
    } catch {
      introSoundEnabled = false;
    }
  }

  function playChallengeCompleteSound(mode = "complete") {
    if (TEST_AUDIO_MUTED) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      introAudioContext = introAudioContext || new AudioContextClass();
      introAudioContext.resume?.();
      const context = introAudioContext;
      const now = context.currentTime;
      const isComplete = mode === "complete";
      const isExit = mode === "exit";

      if (isComplete) {
        const master = context.createGain();
        const sparkle = context.createOscillator();
        const sparkleGain = context.createGain();
        const overtone = context.createOscillator();
        const overtoneGain = context.createGain();
        const tail = context.createOscillator();
        const tailGain = context.createGain();

        master.gain.setValueAtTime(0.001, now);
        master.gain.exponentialRampToValueAtTime(0.9, now + 0.018);
        master.gain.exponentialRampToValueAtTime(0.001, now + 0.92);

        sparkle.type = "sine";
        sparkle.frequency.setValueAtTime(1568, now);
        sparkle.frequency.exponentialRampToValueAtTime(2093, now + 0.18);
        sparkleGain.gain.setValueAtTime(0.001, now);
        sparkleGain.gain.exponentialRampToValueAtTime(0.18, now + 0.022);
        sparkleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

        overtone.type = "triangle";
        overtone.frequency.setValueAtTime(3136, now + 0.055);
        overtone.frequency.exponentialRampToValueAtTime(3951, now + 0.28);
        overtoneGain.gain.setValueAtTime(0.001, now + 0.045);
        overtoneGain.gain.exponentialRampToValueAtTime(0.058, now + 0.085);
        overtoneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        tail.type = "sine";
        tail.frequency.setValueAtTime(2637, now + 0.2);
        tail.frequency.exponentialRampToValueAtTime(3520, now + 0.42);
        tailGain.gain.setValueAtTime(0.001, now + 0.18);
        tailGain.gain.exponentialRampToValueAtTime(0.07, now + 0.24);
        tailGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

        sparkle.connect(sparkleGain);
        overtone.connect(overtoneGain);
        tail.connect(tailGain);
        sparkleGain.connect(master);
        overtoneGain.connect(master);
        tailGain.connect(master);
        master.connect(context.destination);

        sparkle.start(now);
        overtone.start(now + 0.055);
        tail.start(now + 0.2);
        sparkle.stop(now + 0.74);
        overtone.stop(now + 0.58);
        tail.stop(now + 0.92);
        return;
      }

      const duration = isExit ? 0.34 : 0.42;
      const sampleRate = context.sampleRate || 44100;
      const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);

      for (let index = 0; index < data.length; index += 1) {
        const progress = index / data.length;
        const envelope = Math.sin(progress * Math.PI) * (1 - progress * 0.45);
        data[index] = (Math.random() * 2 - 1) * envelope;
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      const chime = context.createOscillator();
      const chimeGain = context.createGain();
      const shimmer = context.createOscillator();
      const shimmerGain = context.createGain();
      const ping = context.createOscillator();
      const pingGain = context.createGain();
      const chimeVolume = isExit ? 0.001 : mode === "intro" ? 0.075 : 0.17;
      const shimmerVolume = isExit ? 0.001 : mode === "intro" ? 0.025 : 0.07;

      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(isExit ? 3200 : 520, now);
      filter.frequency.exponentialRampToValueAtTime(isExit ? 620 : 3200, now + duration * 0.62);
      filter.Q.setValueAtTime(0.9, now);
      noiseGain.gain.setValueAtTime(0.001, now);
      noiseGain.gain.exponentialRampToValueAtTime(isExit ? 0.16 : 0.22, now + 0.045);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      chime.type = "triangle";
      chime.frequency.setValueAtTime(880, now + 0.13);
      chime.frequency.exponentialRampToValueAtTime(1320, now + 0.3);
      chimeGain.gain.setValueAtTime(0.001, now + 0.11);
      chimeGain.gain.exponentialRampToValueAtTime(chimeVolume, now + 0.15);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      shimmer.type = "sine";
      shimmer.frequency.setValueAtTime(1760, now + 0.2);
      shimmerGain.gain.setValueAtTime(0.001, now + 0.18);
      shimmerGain.gain.exponentialRampToValueAtTime(shimmerVolume, now + 0.24);
      shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);

      ping.type = "sine";
      ping.frequency.setValueAtTime(1568, now + 0.62);
      ping.frequency.exponentialRampToValueAtTime(2352, now + 0.82);
      pingGain.gain.setValueAtTime(0.001, now + 0.6);
      pingGain.gain.exponentialRampToValueAtTime(isComplete ? 0.16 : 0.001, now + 0.65);
      pingGain.gain.exponentialRampToValueAtTime(0.001, now + 1.02);

      source.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(context.destination);
      chime.connect(chimeGain);
      shimmer.connect(shimmerGain);
      ping.connect(pingGain);
      chimeGain.connect(context.destination);
      shimmerGain.connect(context.destination);
      pingGain.connect(context.destination);

      source.start(now);
      chime.start(now + 0.12);
      shimmer.start(now + 0.18);
      ping.start(now + 0.6);
      source.stop(now + duration);
      chime.stop(now + 0.5);
      shimmer.stop(now + 0.58);
      ping.stop(now + 1.04);
    } catch {
      introSoundEnabled = false;
    }
  }

  function playLetterSlideSound(direction = "open") {
    if (TEST_AUDIO_MUTED) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    try {
      introAudioContext = introAudioContext || new AudioContextClass();
      introAudioContext.resume?.();
      const context = introAudioContext;
      const now = context.currentTime;
      const duration = 0.18;
      const sampleRate = context.sampleRate || 44100;
      const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
      const data = buffer.getChannelData(0);

      for (let index = 0; index < data.length; index += 1) {
        const progress = index / data.length;
        const envelope = Math.sin(progress * Math.PI) * (1 - progress * 0.3);
        data[index] = (Math.random() * 2 - 1) * envelope;
      }

      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const isOpen = direction !== "close";

      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(isOpen ? 1100 : 2800, now);
      filter.frequency.exponentialRampToValueAtTime(isOpen ? 3600 : 900, now + duration);
      filter.Q.setValueAtTime(0.82, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.13, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(context.destination);
      source.start(now);
      source.stop(now + duration);
    } catch {
      introSoundEnabled = false;
    }
  }

  function fadeAudio(audio, from, to, duration = BGM_FADE_MS, onDone) {
    if (!audio) return;
    const startedAt = Date.now();
    const safeFrom = Math.max(0, Math.min(1, from));
    const safeTo = Math.max(0, Math.min(1, to));

    if (audio._bgmFadeTimer) {
      clearInterval(audio._bgmFadeTimer);
    }

    audio.volume = safeFrom;
    audio._bgmFadeTimer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      audio.volume = safeFrom + (safeTo - safeFrom) * progress;
      if (progress >= 1) {
        clearInterval(audio._bgmFadeTimer);
        audio._bgmFadeTimer = null;
        onDone?.();
      }
    }, 40);
  }

  function stopBgm() {
    currentBgmKey = "";
    if (!bgmAudio) return;
    const audio = bgmAudio;
    bgmAudio = null;
    fadeAudio(audio, audio.volume, 0, 420, () => {
      audio.pause();
      audio.removeAttribute("src");
    });
  }

  function duckBgmForStartTransition() {
    if (!bgmAudio) return;
    fadeAudio(bgmAudio, bgmAudio.volume, 0.035, START_BGM_DUCK_MS);
  }

  function getBgmKeyForView() {
    if (view === "start" || view === "gallery" || view === "help") {
      return "harborIntro";
    }
    if (view === "game" && state?.sceneId) {
      return DATA.sceneBgm?.[state.sceneId] || "";
    }
    if (view === "loading" && state) {
      const loading = state.loadingTransition || voyageLoadingMessage("fitzroy-interview");
      return loading.bgm || "";
    }
    if (view === "ending") {
      return "ending";
    }
    return "";
  }

  function setBgm(key) {
    if (TEST_AUDIO_MUTED) {
      stopBgm();
      return;
    }
    const nextKey = key || "";
    if (nextKey === currentBgmKey) return;

    const previous = bgmAudio;
    if (previous) {
      bgmAudio = null;
      fadeAudio(previous, previous.volume, 0, 420, () => {
        previous.pause();
        previous.removeAttribute("src");
      });
    }

    currentBgmKey = nextKey;
    if (!nextKey) return;

    const src = DATA.bgm?.[nextKey];
    if (!src) {
      currentBgmKey = "";
      return;
    }

    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0;
    bgmAudio = audio;
    audio.play()
      .then(() => {
        if (bgmAudio === audio) {
          fadeAudio(audio, 0, BGM_VOLUME);
        }
      })
      .catch(() => {
        if (bgmAudio === audio) {
          bgmAudio = null;
          currentBgmKey = "";
        }
      });
  }

  function syncBgm() {
    const key = getBgmKeyForView();
    const canTryStartScreenAutoplay = view === "start" && Boolean(key);
    if (!bgmUnlocked && !canTryStartScreenAutoplay) {
      if (!key) stopBgm();
      return;
    }
    setBgm(key);
  }

  function unlockBgm() {
    bgmUnlocked = true;
    syncBgm();
  }

  function setIntroText(text) {
    introText = text;
    const target = app.querySelector("[data-intro-text]");
    if (target) {
      target.textContent = text;
    }
  }

  function getIntroLine(index) {
    if (introMode === "tutorialPrompt") return INTRO_TUTORIAL_PROMPT;
    return String(DATA.introLines?.[index] || "").replace(/([.!?])\s+/g, "$1\n");
  }

  function beginIntro() {
    clearStartTransitionTimer();
    clearTimedChoiceTimers();
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer);
      agentTransitionTimer = null;
    }
    clearIntroTimer();
    clearLetterTimer();
    state = null;
    introLineIndex = 0;
    introMode = "story";
    introText = "";
    tutorialStepIndex = 0;
    closeStartSlots({ immediate: true, render: false });
    view = "intro";
    stopBgm();
    syncBgm();
    startIntroTyping();
  }

  function beginStartTransition(callback = () => startNewRun()) {
    clearStartTransitionTimer();
    unlockIntroSound();
    const screen = app.querySelector(".start-screen");
    if (!screen) {
      callback();
      return;
    }

    screen.classList.add("is-starting");
    duckBgmForStartTransition();
    startWhooshTimer = setTimeout(() => {
      startWhooshTimer = null;
      playStartWhooshSound();
    }, START_WHOOSH_DELAY_MS);
    startTransitionTimer = setTimeout(() => {
      startTransitionTimer = null;
      callback();
    }, START_TRANSITION_MS);
  }

  function startIntroTyping() {
    clearIntroTimer();
    const line = getIntroLine(introLineIndex);
    let cursor = 0;
    introText = "";
    renderIntro();

    introTimer = setInterval(() => {
      cursor += 1;
      playIntroKeySound(line[cursor - 1]);
      setIntroText(line.slice(0, cursor));
      if (cursor >= line.length) {
        clearIntroTimer();
        renderIntro();
      }
    }, INTRO_TYPE_INTERVAL_MS);
  }

  function beginTutorialPrompt() {
    clearIntroTimer();
    introMode = "tutorialPrompt";
    introText = "";
    startIntroTyping();
  }

  function advanceIntro() {
    const line = getIntroLine(introLineIndex);
    if (introTimer) {
      clearIntroTimer();
      setIntroText(line);
      if (introMode === "tutorialPrompt") renderIntro();
      return;
    }

    if (introMode === "tutorialPrompt") return;

    introLineIndex += 1;
    if (introLineIndex >= (DATA.introLines?.length || 0)) {
      beginTutorialPrompt();
      return;
    }
    startIntroTyping();
  }

  function skipIntro() {
    clearIntroTimer();
    beginTutorialPrompt();
  }

  function beginTutorial() {
    clearStartTransitionTimer();
    clearIntroTimer();
    clearTimedChoiceTimers();
    clearLetterTimer();
    clearChallengeCompleteTimer();
    tutorialStepIndex = 0;
    state = null;
    view = "tutorial";
    render();
  }

  function advanceTutorial() {
    tutorialStepIndex += 1;
    if (tutorialStepIndex >= tutorialSteps.length) {
      startActualRun();
      return;
    }
    render();
  }

  function createStateSnapshot() {
    if (!state) return null;
    const snapshot = clone(state);
    snapshot.effectToast = "";
    snapshot.flash = "";
    snapshot.saveSlotMode = "";
    return snapshot;
  }

  function pushHistorySnapshot() {
    const snapshot = createStateSnapshot();
    if (!snapshot) return;
    state.backStack = [...(state.backStack || []), snapshot].slice(-24);
  }

  function canGoBack() {
    if (!state || view !== "game") return false;
    return Boolean(state.choiceOutcome || state.lineIndex > 0 || (state.backStack || []).length);
  }

  function goBack() {
    if (!canGoBack()) return;
    clearTimedChoiceTimers();
    clearLetterTimer();
    clearChallengeCompleteTimer();
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer);
      agentTransitionTimer = null;
    }
    if (state.choiceOutcome && (state.backStack || []).length) {
      const previous = state.backStack[state.backStack.length - 1];
      state = normalizeState(previous);
      view = "game";
      state.view = "game";
      render();
      return;
    }
    if (state.lineIndex > 0) {
      state.lineIndex -= 1;
      state.choiceOutcome = null;
      state.pendingTransition = null;
      render();
      return;
    }
    if ((state.backStack || []).length) {
      const previous = state.backStack[state.backStack.length - 1];
      state = normalizeState(previous);
      view = "game";
      state.view = "game";
      render();
    }
  }

  function enterScene(sceneId) {
    sceneId = resolveSceneId(sceneId);
    const scene = sceneById.get(sceneId);
    if (!scene) return;

    clearTimedChoiceTimers();
    clearLetterTimer();
    state.sceneId = sceneId;
    state.mood = scene.portrait || state.mood || "neutral";
    state.lineIndex = 0;
    state.showStats = false;
    state.showNotes = false;
    state.showLetter = false;
    state.letterPage = 0;
    state.saveSlotMode = "";
    state.choiceOutcome = null;
    state.pendingTransition = null;
    state.loadingTransition = null;
    state.timedChoiceSceneId = "";
    state.timedChoiceDeadline = 0;
    state.timedChoiceRemaining = 0;

    if (!state.visitedScenes.includes(sceneId)) {
      state.visitedScenes.push(sceneId);
      applyEffects(scene.onEnter?.effects);
      addNotes(scene.onEnter?.addNotes);
    }
    preloadSceneAssets(scene);
  }

  function startNewRun(skipIntro = false) {
    if (!skipIntro) {
      beginIntro();
      return;
    }
    beginTutorial();
  }

  function startActualRun() {
    clearStartTransitionTimer();
    clearIntroTimer();
    clearTimedChoiceTimers();
    clearLetterTimer();
    tutorialStepIndex = 0;
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer);
      agentTransitionTimer = null;
    }
    state = normalizeState({
      view: "game",
      sceneId: playableScenes[0]?.id || DATA.scenes[0].id,
    });
    view = "game";
    enterScene(state.sceneId);
    render();
  }

  function getSerializableState() {
    if (!state) return;
    const saved = clone(state);
    saved.view = view;
    saved.savedAt = new Date().toISOString();
    saved.backStack = [];
    saved.saveSlotMode = "";
    saved.showLetter = false;
    saved.letterPage = 0;
    saved.effectToast = "";
    saved.challengeComplete = null;
    saved.flash = "";
    saved.timedChoiceSceneId = "";
    saved.timedChoiceDeadline = 0;
    saved.timedChoiceRemaining = 0;
    Object.values(saved.agentChats || {}).forEach((chat) => {
      if (chat) chat.pending = false;
    });
    return saved;
  }

  function saveRun(slot = state?.activeSlot || 1, options = {}) {
    if (!state || !slot) return;
    const saved = getSerializableState();
    saved.activeSlot = slot;
    localStorage.setItem(getSaveSlotKey(slot), JSON.stringify(saved));
    state.activeSlot = slot;
    state.saveSlotMode = "";
    if (!options.silent) {
      state.flash = `슬롯 ${slot}에 저장되었습니다.`;
    }
    render();
  }

  function openSaveSlots(mode) {
    if (!state) return;
    state.saveSlotMode = mode;
  state.showStats = false;
  state.showNotes = false;
  state.showLetter = false;
  state.letterPage = 0;
  clearLetterTimer();
    render();
  }

  function loadRun(slot) {
    clearIntroTimer();
    clearTimedChoiceTimers();
    clearLetterTimer();
    clearChallengeCompleteTimer();
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer);
      agentTransitionTimer = null;
    }
    const targetSlot = slot || getLatestSaveSlot()?.slot;
    const rawSave = targetSlot ? localStorage.getItem(getSaveSlotKey(targetSlot)) : "";
    if (!rawSave) {
      startMessage = "불러올 저장 데이터가 없습니다.";
      view = "start";
      render();
      return;
    }

    try {
      state = normalizeState(JSON.parse(rawSave));
      state.activeSlot = targetSlot || state.activeSlot || null;
      state.saveSlotMode = "";
      view = state.view === "ending" ? "ending" : "game";
      state.view = view;
      state.flash = targetSlot ? `슬롯 ${targetSlot}을 불러왔습니다.` : "저장 데이터를 불러왔습니다.";
      render();
    } catch {
      startMessage = "저장 데이터를 읽지 못했습니다. 처음부터 시작해 주세요.";
      view = "start";
      render();
    }
  }

  function clearSave() {
    clearIntroTimer();
    clearTimedChoiceTimers();
    clearLetterTimer();
    clearChallengeCompleteTimer();
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer);
      agentTransitionTimer = null;
    }
    clearSaveSlots();
    state = null;
    closeStartSlots({ immediate: true, render: false });
    resetConfirmOpen = false;
    view = "start";
    showScreenToast("저장 슬롯을 삭제했습니다.");
  }

  function clearAllProgress() {
    clearIntroTimer();
    clearTimedChoiceTimers();
    clearLetterTimer();
    clearChallengeCompleteTimer();
    if (loadingTimer) {
      clearTimeout(loadingTimer);
      loadingTimer = null;
    }
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer);
      agentTransitionTimer = null;
    }
    clearSaveSlots();
    localStorage.removeItem(GALLERY_KEY);
    state = null;
    closeStartSlots({ immediate: true, render: false });
    galleryPreviewEndingId = "";
    resetConfirmOpen = false;
    startMessage = "";
    view = "start";
    showScreenToast("모든 진행 정보가 초기화되었습니다.");
  }

  function handleChoice(choiceId) {
    const scene = sceneById.get(state.sceneId);
    const choice = getDisplayChoices(scene).find((item) => item.id === choiceId);
    if (!choice) return;

    clearTimedChoiceTimers();
    pushHistorySnapshot();
    const effectText = choice.effectText || statEffectText(choice.effects);
    const triggerLabel = choiceReplies[choice.id] || choice.label;
    const rawNextScene = choice.nextScene || scene.next;
    const isFinalChoice = rawNextScene === "__final__";
    const nextScene = isFinalChoice ? "__final__" : resolveSceneId(rawNextScene);
    const backgroundLineIndex = state.lineIndex;
    applyEffects(choice.effects);
    addNotes(choice.addNotes);
    const choiceMood = choice.mood || state.mood;
    const outcomeDefaults = {
      name: "선택의 결과",
      role: triggerLabel,
      cast: choice.outcomeCast || null,
    };
    const outcomeLines = getChoiceOutcomeLines(choice, scene, outcomeDefaults);
    state.mood = choiceMood;
    state.choiceOutcome = {
      type: "outcome",
      name: outcomeDefaults.name,
      role: outcomeDefaults.role,
      text: "",
      lines: outcomeLines,
      lineIndex: 0,
      defaultName: outcomeDefaults.name,
      defaultRole: outcomeDefaults.role,
      defaultCast: outcomeDefaults.cast,
      background: choice.outcomeBackground || null,
      backgroundLineIndex,
    };
    applyOutcomeBeat(state.choiceOutcome, outcomeLines[0]);
    state.pendingTransition = {
      badEndingId: choice.badEndingId || null,
      nextScene,
      final: isFinalChoice,
      mood: choiceMood,
    };
    state.lineIndex = getSceneBeats(scene).length;
    showEffectToast(effectText);
    render();
  }

  function getChoiceOutcome(choice, scene) {
    if (choiceOutcomes[choice.id]) return choiceOutcomes[choice.id];
    const reflectSceneId = choice.id.startsWith("reflect-") ? choice.id.replace(/^reflect-/, "") : "";
    if (reflectChoiceOverrides[reflectSceneId]?.outcome) return reflectChoiceOverrides[reflectSceneId].outcome;
    if (choice.id.startsWith("reflect-")) {
      return "다윈은 곧장 답하지 않고 주변의 말과 풍경을 한 번 더 살핀다. 성급함 대신 관찰이 노트에 남는다.";
    }
    return `${scene.title}에서의 선택이 다음 항해의 태도를 조금 바꾸어 놓는다.`;
  }

  function normalizeOutcomeBeat(line, defaults = {}) {
    if (line && typeof line === "object") {
      const text = String(line.text || "").trim();
      if (!text) return null;
      return {
        type: "outcome",
        ...line,
        text,
        name: line.name || defaults.name || "선택의 결과",
        role: line.role || defaults.role || "",
        cast: line.cast || defaults.cast || null,
        note: line.note || "",
      };
    }
    const text = String(line || "").trim();
    if (!text) return null;
    return {
      type: "outcome",
      text,
      name: defaults.name || "선택의 결과",
      role: defaults.role || "",
      cast: defaults.cast || null,
      note: "",
    };
  }

  function applyOutcomeBeat(outcome, beat) {
    if (!outcome || !beat) return;
    if (typeof beat !== "object") {
      beat = normalizeOutcomeBeat(beat, {
        name: outcome.defaultName || outcome.name,
        role: outcome.defaultRole || outcome.role,
        cast: outcome.defaultCast || outcome.cast,
      });
      if (!beat) return;
    }
    outcome.text = beat.text || "";
    outcome.name = beat.name || outcome.defaultName || "선택의 결과";
    outcome.role = beat.role || outcome.defaultRole || "";
    outcome.speaker = beat.speaker || "";
    outcome.portrait = beat.portrait || beat.speaker || "";
    outcome.cast = beat.cast || outcome.defaultCast || null;
    outcome.note = beat.note || "";
  }

  function getChoiceOutcomeLines(choice, scene, defaults = {}) {
    const outcome = choice.outcomeLines || getChoiceOutcome(choice, scene);
    const lines = Array.isArray(outcome) ? outcome : [outcome];
    return lines.map((line) => normalizeOutcomeBeat(line, defaults)).filter(Boolean);
  }

  function getSceneBackgroundKey(scene) {
    const changes = Array.isArray(scene?.backgroundChanges) ? scene.backgroundChanges : [];
    const lineIndex = Number(state?.choiceOutcome?.backgroundLineIndex ?? state?.lineIndex ?? 0);
    return changes.reduce((current, change) => {
      const changeLine = Number(change?.lineIndex);
      if (!Number.isFinite(changeLine) || lineIndex < changeLine) return current;
      return change.background || current;
    }, scene?.background);
  }

  function completePendingTransition() {
    if (!state?.pendingTransition) return;
    const transition = state.pendingTransition;
    const fromSceneId = state.sceneId;
    state.choiceOutcome = null;
    state.pendingTransition = null;

    if (transition.badEndingId) {
      endGame(transition.badEndingId);
      return;
    }

    if (transition.final) {
      resolveFinalEnding();
      return;
    }

    const nextScene = resolveSceneId(transition.nextScene);
    if (shouldShowVoyageLoading(fromSceneId, nextScene)) {
      startVoyageLoading(fromSceneId, nextScene, transition.mood);
      return;
    }

    enterScene(nextScene);
    state.mood = transition.mood || state.mood;
    render();
  }

  function shouldShowVoyageLoading(fromSceneId, nextSceneId) {
    return (
      (fromSceneId === "fitzroy-interview" && nextSceneId === "brazil") ||
      (fromSceneId === "galapagos-finches" && nextSceneId === "storm-seasick") ||
      (fromSceneId === "storm-help" && nextSceneId === "tahiti-network") ||
      (fromSceneId === "cocos" && nextSceneId === "return-storm-event") ||
      (fromSceneId === "return-storm-event" && nextSceneId === "london-malthus")
    );
  }

  function voyageLoadingMessage(fromSceneId) {
    if (fromSceneId === "galapagos-finches") {
      return {
        title: "태평양을 건너는 중",
        line: "비글호는 갈라파고스를 떠나 태평양 너머 다음 항구로 향한다.",
        image: "voyageLoading",
        bgm: "voyage",
        duration: 2000,
        phase: "pacific-before-storm",
      };
    }
    if (fromSceneId === "storm-help") {
      return {
        title: "태평양을 건너는 중",
        line: "폭풍을 넘긴 비글호는 다시 잔잔해진 태평양 위를 나아간다.",
        image: "voyageLoading",
        bgm: "voyage",
        duration: 2000,
      };
    }
    if (fromSceneId === "cocos") {
      return {
        title: "영국으로 돌아가는 항해",
        line: "비글호는 긴 항해의 기록을 싣고 런던으로 향한다.",
        image: "voyageLoading",
        bgm: "voyage",
        duration: 2000,
        phase: "return-before-storm",
      };
    }
    if (fromSceneId === "return-storm-event") {
      return {
        title: "영국으로 돌아가는 항해",
        line: "비글호는 폭풍을 지나 긴 항해의 기록을 싣고 런던으로 향한다.",
        image: "voyageLoading",
        bgm: "voyage",
        duration: 2000,
      };
    }
    return {
      title: "비글호 출항",
      line: "영국을 떠난 배가 대서양 위로 천천히 나아간다.",
      image: "voyageLoading",
      bgm: "voyage",
      duration: 2000,
    };
  }

  function stormAlertLoadingMessage() {
    return {
      title: "돌발 이벤트 발생!",
      line: "귀국길의 바다가 갑자기 검게 뒤틀린다.",
      image: "stormSea",
      eyebrow: "돌발 이벤트",
      variant: "event-alert",
      bgm: "typhoon",
      duration: 1500,
      phase: "storm-alert",
    };
  }

  function pacificStormLoadingMessage() {
    return {
      title: "태풍을 만난 비글호",
      line: "갑자기 거칠어진 파도가 배를 흔들고 갑판 위의 고함이 커진다.",
      image: "stormSea",
      eyebrow: "태평양",
      bgm: "typhoon",
      duration: 1500,
      phase: "pacific-storm-alert",
    };
  }

  function startVoyageLoading(fromSceneId, nextSceneId, mood) {
    clearTimedChoiceTimers();
    const message = voyageLoadingMessage(fromSceneId);
    state.loadingTransition = {
      fromSceneId,
      nextSceneId,
      mood,
      ...message,
    };
    view = "loading";
    state.view = "loading";
    render();

    if (loadingTimer) {
      clearTimeout(loadingTimer);
    }
    const finishLoading = () => {
      if (!state?.loadingTransition || state.loadingTransition.nextSceneId !== nextSceneId) return;
      const transition = state.loadingTransition;
      if (transition.phase === "return-before-storm") {
        state.loadingTransition = {
          fromSceneId,
          nextSceneId,
          mood,
          ...stormAlertLoadingMessage(),
        };
        render();
        loadingTimer = setTimeout(finishLoading, state.loadingTransition.duration || 1500);
        return;
      }
      if (transition.phase === "pacific-before-storm") {
        state.loadingTransition = {
          fromSceneId,
          nextSceneId,
          mood,
          ...pacificStormLoadingMessage(),
        };
        render();
        loadingTimer = setTimeout(finishLoading, state.loadingTransition.duration || 1500);
        return;
      }
      view = "game";
      state.view = "game";
      enterScene(transition.nextSceneId);
      state.mood = transition.mood || state.mood;
      loadingTimer = null;
      render();
    };
    loadingTimer = setTimeout(finishLoading, state.loadingTransition.duration || 2000);
  }

  function showEffectToast(text) {
    if (!text) return;
    state.effectToast = text;
    if (effectTimer) {
      clearTimeout(effectTimer);
    }
    effectTimer = setTimeout(() => {
      if (!state) return;
      state.effectToast = "";
      if (state.challengeComplete) return;
      render();
    }, 2200);
  }

  function getScore(stats, scoreId) {
    const keys = DATA.scoreStats?.[scoreId] || [];
    return keys.reduce((total, key) => total + Number(stats[key] || 0), 0);
  }

  function getScores(stats = state?.stats || {}) {
    return {
      scienceScore: getScore(stats, "scienceScore"),
      ethicsScore: getScore(stats, "ethicsScore"),
    };
  }

  function resolveFinalEnding() {
    const stats = state.stats;
    const { scienceScore, ethicsScore } = getScores(stats);

    if (scienceScore < 16) {
      endGame("unfinishedManuscript");
      return;
    }

    if (ethicsScore < 15) {
      endGame("aEnding");
      return;
    }

    endGame("sEnding");
  }

  function endGame(endingId) {
    state.endingId = endingId;
    view = "ending";
    state.view = view;
    unlockEnding(endingId);
    render();
  }

  function statEffectText(effects = {}) {
    const scores = {
      scienceScore: (DATA.scoreStats?.scienceScore || []).reduce((total, key) => total + Number(effects[key] || 0), 0),
      ethicsScore: (DATA.scoreStats?.ethicsScore || []).reduce((total, key) => total + Number(effects[key] || 0), 0),
    };
    const entries = Object.entries(scores).filter(([, value]) => value);
    if (!entries.length) return "";
    return entries
      .map(([key, value]) => {
        const sign = value > 0 ? "+" : "";
        return `${DATA.statLabels[key] || key} ${sign}${value}`;
      })
      .join(" · ");
  }

  function isAgentScene(sceneId) {
    return Boolean(agentSceneConfigs[sceneId]);
  }

  function ensureAgentChat(sceneId) {
    const config = agentSceneConfigs[sceneId];
    if (!config) return null;
    state.agentChats = state.agentChats || {};
    if (!state.agentChats[sceneId]) {
      state.agentChats[sceneId] = {
        messages: [{ role: "agent", text: config.opening }],
        score: 50,
        mood: "neutral",
        pending: false,
        locked: false,
        verdict: "",
        error: "",
        challengeIntroStarted: false,
        challengeIntroDone: false,
      };
    }
    const chat = state.agentChats[sceneId];
    chat.messages = Array.isArray(chat.messages) ? chat.messages : [{ role: "agent", text: config.opening }];
    chat.score = Number.isFinite(chat.score) ? chat.score : 50;
    chat.mood = chat.mood || "bad";
    chat.error = chat.error || "";
    chat.challengeIntroStarted = Boolean(chat.challengeIntroStarted);
    chat.challengeIntroDone = Boolean(chat.challengeIntroDone);
    return chat;
  }

  function getAgentBackground(sceneId) {
    const config = agentSceneConfigs[sceneId];
    const chat = ensureAgentChat(sceneId);
    if (!config || !chat) return "";
    const imageKey = chat.mood === "good" || chat.score >= 80 ? config.backgrounds.good : config.backgrounds.bad;
    return DATA.images[imageKey] || "";
  }

  function armAgentChallengeIntro(sceneId, shouldShow) {
    if (!shouldShow) return false;
    const config = agentSceneConfigs[sceneId];
    const chat = ensureAgentChat(sceneId);
    if (!config || !chat || chat.challengeIntroDone || chat.locked || chat.verdict) return false;

    if (!chat.challengeIntroStarted) {
      chat.challengeIntroStarted = true;
      state.challengeComplete = {
        mode: "intro",
        eyebrow: "대화형 챌린지",
        title: config.challengeTitle || `${config.targetLabel} 설득`,
        status: "",
      };
      playChallengeCompleteSound("intro");
      scheduleChallengeExitSound(CHALLENGE_INTRO_MS);
      challengeCompleteTimer = setTimeout(() => {
        challengeCompleteTimer = null;
        if (!state || state.sceneId !== sceneId) return;
        const currentChat = ensureAgentChat(sceneId);
        currentChat.challengeIntroDone = true;
        state.challengeComplete = null;
        render();
      }, CHALLENGE_INTRO_MS);
    }

    return true;
  }

  function buildAgentPrompt(sceneId, chat) {
    const config = agentSceneConfigs[sceneId];
    const history = chat.messages
      .map((message) => `${message.role === "player" ? "찰스 다윈" : config.targetName}: ${message.text}`)
      .join("\n");

    return `
${config.role}

플레이어는 찰스 다윈이다. 아래 대화 기록을 보고 ${config.targetLabel}의 다음 대사를 한국어로 작성하고, 호감도 점수를 0부터 100까지 평가하라.
현재 호감도는 ${chat.score}점이다. 새 score는 이번 플레이어 발언 이후의 현재 호감도다.

판정 기준:
- 첫 호감도는 50점에서 시작한다.
- 좋은 설득이면 score를 올리고, 무례하거나 무책임하면 score를 내린다.
- 호감도가 올라간다면 반드시 현재 호감도보다 10~15점만 올린다.
- score가 ${AGENT_PASS_SCORE} 이상이면 passed를 true로 둔다. ${AGENT_PASS_SCORE} 미만이면 passed는 false다.
- score가 0이면 rejected를 true로 둔다. 0보다 크면 rejected는 false다.
- 아직 1~${AGENT_PASS_SCORE - 1}점이면 대화를 계속한다.
- mood는 score가 70 이상이면 "good", 35 이상이면 "neutral", 그보다 낮으면 "bad"로 둔다.
- reply는 인물의 성격에 맞는 짧은 대화체 한두 문장으로 한다.
- 학술 설명, 역사 강의, 평가표 같은 말투는 피한다.
- 플레이어가 일상적인 말투로 답해도 의도를 읽고 자연스럽게 반응한다.
- 점수가 오르지 않는 경우 힌트를 포함하여 답변한다

반드시 아래 JSON 형식 하나만 출력하라.
{
  "reply": "인물의 응답",
  "score": 0,
  "mood": "bad",
  "passed": false,
  "rejected": false,
  "reason": "짧은 평가 이유"
}

대화 기록:
${history}
`.trim();
  }

  function parseGeminiJson(text) {
    const raw = String(text || "").trim();
    try {
      return JSON.parse(raw);
    } catch {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return JSON.parse(raw.slice(start, end + 1));
      }
      throw new Error("AI 응답을 JSON으로 읽지 못했습니다.");
    }
  }

  function normalizeAgentResult(sceneId, parsed, previousScore = 50) {
    const config = agentSceneConfigs[sceneId];
    const fallbackScore = Number.isFinite(Number(parsed.score)) ? Number(parsed.score) : 50;
    const rawScore = Math.max(0, Math.min(100, Math.round(fallbackScore)));
    const currentScore = Math.max(0, Math.min(100, Math.round(Number(previousScore) || 50)));
    let score = rawScore;
    if (rawScore > currentScore) {
      const requestedGain = rawScore - currentScore;
      const gain = Math.max(10, Math.min(15, requestedGain));
      score = Math.min(100, currentScore + gain);
    }
    const mood = ["bad", "neutral", "good"].includes(parsed.mood) ? parsed.mood : score >= 80 ? "good" : score >= 35 ? "neutral" : "bad";
    return {
      reply: String(parsed.reply || config.opening),
      score,
      mood,
      passed: score >= AGENT_PASS_SCORE,
      rejected: score <= 0 || Boolean(parsed.rejected) && score <= 0,
      reason: String(parsed.reason || ""),
    };
  }

  function hasLikelyTypo(text) {
    const value = String(text || "").trim();
    if (!value) return false;

    const compact = value.replace(/\s/g, "");
    if (/^[ㄱ-ㅎㅏ-ㅣ.,!?~…]+$/.test(compact) && compact.length >= 2) return true;
    if (/([ㄱ-ㅎㅏ-ㅣ])\1{2,}/.test(compact)) return true;
    if (/[a-zA-Z]{4,}/.test(compact) && !/[가-힣]/.test(compact)) return true;
    if (/(.)\1{5,}/.test(compact)) return true;

    const unclearChars = (compact.match(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.,!?~…'"()]/g) || []).length;
    return compact.length >= 6 && unclearChars / compact.length > 0.35;
  }

  function applyFitzroyTypoReaction(sceneId, result, previousScore, draft) {
    if (sceneId !== "fitzroy-interview" || !hasLikelyTypo(draft)) return result;
    const score = Math.max(0, Math.min(result.score - 12, (Number(previousScore) || 50) - 10));
    const reply = result.reply.includes(FITZROY_TYPO_LINE)
      ? result.reply
      : `${FITZROY_TYPO_LINE} 다시, 알아들을 수 있게 말해보게.`;
    return {
      ...result,
      reply,
      score,
      mood: score >= 70 ? "good" : score >= 35 ? "neutral" : "bad",
      passed: false,
      rejected: score <= 0,
      reason: result.reason || "선장이 알아듣기 어려운 답변으로 판단했다.",
    };
  }

  function getGeminiModels() {
    return [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS].filter(Boolean))];
  }

  function buildGeminiRequestBody(sceneId, chat) {
    return {
      contents: [
        {
          role: "user",
          parts: [{ text: buildAgentPrompt(sceneId, chat) }],
        },
      ],
      generationConfig: {
        temperature: 0.75,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            reply: { type: "string" },
            score: { type: "integer" },
            mood: { type: "string" },
            passed: { type: "boolean" },
            rejected: { type: "boolean" },
            reason: { type: "string" },
          },
          required: ["reply", "score", "mood", "passed", "rejected", "reason"],
        },
      },
    };
  }

  async function requestGeminiProxy(body) {
    const response = await fetch("/api/gemini", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        models: getGeminiModels(),
        body,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.error || `AI API 요청이 실패했습니다. (${response.status})`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return {
      model: data.model || GEMINI_MODEL,
      text: String(data.text || "").trim(),
    };
  }

  async function requestGeminiAgentReply(sceneId, chat) {
    const body = buildGeminiRequestBody(sceneId, chat);
    const { text, model } = await requestGeminiProxy(body);
    return { ...normalizeAgentResult(sceneId, parseGeminiJson(text), chat.score), model };
  }

  async function handleAgentChatSubmit(sceneId) {
    if (!state || state.sceneId !== sceneId || !isAgentScene(sceneId)) return;
    unlockIntroSound();
    const config = agentSceneConfigs[sceneId];
    const chat = ensureAgentChat(sceneId);
    const draft = String(state.agentDrafts?.[sceneId] || "").trim();
    if (!draft || chat.pending || chat.locked) {
      if (!draft) {
        chat.error = "대답을 입력해 주세요.";
        render();
      }
      return;
    }

    const submittedDraft = draft;
    const previousScore = chat.score;
    chat.messages.push({ role: "player", text: submittedDraft });
    chat.pending = true;
    chat.error = "";
    state.agentDrafts[sceneId] = "";
    render();

    try {
      const result = applyFitzroyTypoReaction(
        sceneId,
        await requestGeminiAgentReply(sceneId, chat),
        previousScore,
        submittedDraft,
      );
      if (!state || state.sceneId !== sceneId) return;
      chat.pending = false;
      chat.score = result.score;
      chat.mood = result.mood;
      chat.messages.push({ role: "agent", text: result.reply });

      const userTurns = chat.messages.filter((message) => message.role === "player").length;
      const canPass = result.score >= AGENT_PASS_SCORE;
      const shouldFail = result.score <= 0 || (userTurns >= config.maxTurns && result.score < AGENT_PASS_SCORE);

      if (canPass) {
        chat.locked = true;
        chat.verdict = "success";
        render();
        scheduleAgentSceneFinish(sceneId, true, result);
        return;
      }

      if (shouldFail) {
        chat.locked = true;
        chat.verdict = "failure";
        render();
        scheduleAgentSceneFinish(sceneId, false, result);
        return;
      }

      render();
    } catch (error) {
      if (!state || state.sceneId !== sceneId) return;
      chat.pending = false;
      chat.error = error.message || "AI 응답을 가져오지 못했습니다.";
      render();
    }
  }

  function scheduleAgentSceneFinish(sceneId, passed, result) {
    if (agentTransitionTimer) {
      clearTimeout(agentTransitionTimer);
    }
    agentTransitionTimer = setTimeout(() => {
      if (!state || state.sceneId !== sceneId) return;
      finishAgentScene(sceneId, passed, result);
      agentTransitionTimer = null;
    }, AGENT_VERDICT_DELAY_MS);
  }

  function finishAgentScene(sceneId, passed, result) {
    const config = agentSceneConfigs[sceneId];
    const effects = passed ? config.successEffects : config.failureEffects;

    pushHistorySnapshot();
    applyEffects(effects);
    addNotes([
      `people|${config.targetLabel} 대화 판정: ${result.score}점. ${passed ? "허락을 얻었다." : "신뢰를 얻지 못했다."}`,
    ]);
    showEffectToast(statEffectText(effects));

    if (!passed) {
      endGame(config.badEndingId);
      return;
    }

    showAgentChallengeComplete(sceneId, () => continuePassedAgentScene(sceneId));
  }

  function showAgentChallengeComplete(sceneId, onDone) {
    const config = agentSceneConfigs[sceneId];
    clearChallengeCompleteTimer(false);
    const chat = ensureAgentChat(sceneId);
    if (chat) {
      chat.challengeIntroStarted = true;
      chat.challengeIntroDone = true;
    }
    state.challengeComplete = {
      mode: "complete",
      eyebrow: "대화형 챌린지",
      title: config.challengeTitle || `${config.targetLabel} 설득`,
      status: "",
      corner: "완료",
    };
    playChallengeCompleteSound("intro");
    scheduleChallengeExitSound(CHALLENGE_COMPLETE_MS);
    render();
    scheduleChallengeCompletePingSound(CHALLENGE_COMPLETE_MS);
    challengeCompleteTimer = setTimeout(() => {
      challengeCompleteTimer = null;
      if (!state || state.sceneId !== sceneId) return;
      state.challengeComplete = null;
      onDone?.();
    }, CHALLENGE_COMPLETE_MS);
  }

  function continuePassedAgentScene(sceneId) {
    const config = agentSceneConfigs[sceneId];
    const nextScene = resolveSceneId(config.nextScene);
    if (shouldShowVoyageLoading(sceneId, nextScene)) {
      startVoyageLoading(sceneId, nextScene, "determined");
      return;
    }

    enterScene(nextScene);
    state.mood = "determined";
    render();
  }

  function getSceneBeats(scene) {
    if (state?.choiceOutcome) {
      return [state.choiceOutcome];
    }
    const beats = scene.text.map((line) => ({
      type: "narration",
      name: "관찰 노트",
      role: scene.location,
      text: line,
    }));
    const speaker = speakerMeta[scene.id];
    if (speaker) {
      beats.push({
        type: "speaker",
        ...speaker,
        text: speaker.line,
      });
    }
    return beats;
  }

  function getCurrentBeat(scene) {
    const beats = getSceneBeats(scene);
    return beats[Math.min(state.lineIndex, beats.length - 1)] || beats[0];
  }

  function choicesVisible(scene) {
    if (state.choiceOutcome) return false;
    return state.lineIndex >= getSceneBeats(scene).length;
  }

  function updateTimedChoiceRemaining() {
    if (!state?.timedChoiceDeadline) return 0;
    const remaining = Math.max(0, Math.ceil((state.timedChoiceDeadline - Date.now()) / 1000));
    state.timedChoiceRemaining = remaining;
    return remaining;
  }

  function updateTimedChoiceDisplay(scene) {
    if (!scene?.timeLimitSeconds) return;
    const timer = app.querySelector("[data-timed-choice-timer]");
    if (!timer) return;
    const remaining = Math.max(0, state?.timedChoiceRemaining || 0);
    const total = Math.max(1, Number(scene.timeLimitSeconds) || 5);
    const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
    const count = timer.querySelector("[data-timed-choice-count]");
    const bar = timer.querySelector("[data-timed-choice-bar]");
    timer.setAttribute("aria-label", `남은 시간 ${remaining}초`);
    if (count) count.textContent = String(remaining);
    if (bar) bar.style.setProperty("--timer-progress", `${progress}%`);
  }

  function triggerTimedChoiceTimeout(sceneId) {
    if (!state || view !== "game" || state.sceneId !== sceneId) return;
    const scene = sceneById.get(sceneId);
    if (!scene || !choicesVisible(scene) || state.pendingTransition) return;
    const fallbackChoice = scene.timeoutChoiceId || scene.choices?.[scene.choices.length - 1]?.id;
    if (fallbackChoice) handleChoice(fallbackChoice);
  }

  function armTimedChoice(scene, showChoices) {
    if (!scene?.timeLimitSeconds || !showChoices || state.choiceOutcome || state.pendingTransition) {
      clearTimedChoiceTimers();
      return;
    }

    if (state.timedChoiceSceneId !== scene.id || !state.timedChoiceDeadline) {
      clearTimedChoiceTimers();
      const seconds = Math.max(1, Number(scene.timeLimitSeconds) || 5);
      state.timedChoiceSceneId = scene.id;
      state.timedChoiceDeadline = Date.now() + seconds * 1000;
      state.timedChoiceRemaining = seconds;
      timedChoiceTimer = setTimeout(() => triggerTimedChoiceTimeout(scene.id), seconds * 1000);
      timedChoiceTickTimer = setInterval(() => {
        if (!state || view !== "game" || state.sceneId !== scene.id || !choicesVisible(scene)) {
          clearTimedChoiceTimers();
          return;
        }
        const previous = state.timedChoiceRemaining;
        const remaining = updateTimedChoiceRemaining();
        if (remaining !== previous) updateTimedChoiceDisplay(scene);
      }, 250);
      return;
    }

    updateTimedChoiceRemaining();
    updateTimedChoiceDisplay(scene);
  }

  function advanceDialogue() {
    if (!state || view !== "game") return;
    if (state.pendingTransition && state.choiceOutcome) {
      const outcome = state.choiceOutcome;
      const lines = Array.isArray(outcome.lines) ? outcome.lines : [];
      if (lines.length && outcome.lineIndex < lines.length - 1) {
        outcome.lineIndex += 1;
        applyOutcomeBeat(outcome, lines[outcome.lineIndex]);
        render();
        return;
      }
      completePendingTransition();
      return;
    }
    const scene = sceneById.get(state.sceneId);
    if (!scene || choicesVisible(scene)) return;
    state.lineIndex += 1;
    render();
  }

  function shouldAdvanceFromBlankClick(event) {
    const target = event.target;
    if (!target?.closest?.(".vn-stage")) return false;
    if (target.closest("button, input, textarea, select, a")) return false;
    if (target.closest(".vn-choice-panel, .agent-chat-panel, .hud-panel, .vn-topbar, .vn-route")) return false;
    return true;
  }

  function shuffleChoiceIds(ids) {
    const shuffled = [...ids];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
    }
    return shuffled;
  }

  function getDisplayChoices(scene) {
    if (!scene) return [];
    const choices = [...(scene.choices || [])];
    if (!choices.length) return [];
    if (choices.length < 3 && !scene.disableReflectChoice) {
      const nextScene = resolveSceneId(scene.next || choices[0]?.nextScene);
      const reflectOverride = reflectChoiceOverrides[scene.id] || {};
      choices.splice(1, 0, {
        id: `reflect-${scene.id}`,
        label: reflectChoiceLabels[scene.id] || "잠깐 멈춰 관찰을 더 확인하고 답한다",
        effects: reflectOverride.effects || { observation: 1 },
        addNotes: reflectOverride.addNotes || [`theory|${scene.title}: 성급히 답하지 않고 맥락을 한 번 더 확인했다.`],
        mood: "neutral",
        nextScene: reflectOverride.nextScene || nextScene,
      });
    }

    const limitedChoices = choices.slice(0, 3);
    const ids = limitedChoices.map((choice) => choice.id);
    state.choiceOrders = state.choiceOrders || {};
    const savedOrder = state.choiceOrders[scene.id] || [];
    const orderMatches = savedOrder.length === ids.length && ids.every((id) => savedOrder.includes(id));
    const order = orderMatches ? savedOrder : shuffleChoiceIds(ids);
    state.choiceOrders[scene.id] = order;
    return order.map((id) => limitedChoices.find((choice) => choice.id === id)).filter(Boolean);
  }

  function renderStart() {
    const slots = getSaveSlots();
    const hasSave = slots.some((item) => item.data);
    const unlocked = getUnlockedEndings();
    const galleryTotal = getGalleryEndings().length;
    const unlockedTotal = Object.keys(unlocked).filter((id) => DATA.endings[id]).length;
    const galleryProgress = `${unlockedTotal}/${galleryTotal}`;
    const startBackground = DATA.images.startHarbor || DATA.images.harborStudy;
    app.innerHTML = `
      <main class="start-screen" style="--hero-image: url('${escapeHtml(cssAssetUrl(startBackground))}')">
        <section class="start-panel" aria-label="게임 시작 화면">
          <div class="start-brand">
            <p class="eyebrow">비주얼 노벨형 탐험 게임</p>
            <h1><span>비글호 항해기:</span><span>다윈의 관찰노트</span></h1>
            ${startMessage ? `<p class="notice">${escapeHtml(startMessage)}</p>` : ""}
          </div>
          <nav class="start-menu" aria-label="시작 메뉴">
            <button type="button" class="start-menu-button is-primary" data-action="start">
              <span class="start-menu-text">새 항해 시작</span>
            </button>
            <button type="button" class="start-menu-button${startSlotMenuOpen && !startSlotMenuClosing ? " is-active" : ""}" data-action="continue" aria-expanded="${startSlotMenuOpen && !startSlotMenuClosing ? "true" : "false"}">
              <span class="start-menu-text">이어하기</span>
            </button>
            <button type="button" class="start-menu-button" data-action="gallery">
              <span class="start-menu-text">엔딩 갤러리</span>
              <small>${galleryProgress}</small>
            </button>
            <button type="button" class="start-menu-button" data-action="help">
              <span class="start-menu-text">도움말</span>
            </button>
          </nav>
        </section>
        <p class="start-ai-notice">* 본 게임은 생성형 인공지능을 사용하여 생성된 이미지와 음악을 사용합니다.</p>
        ${renderScreenToast()}
        ${
          startSlotMenuOpen
            ? `<aside class="start-slot-overlay${startSlotMenuClosing ? " is-closing" : ""}" data-action="close-start-slots" aria-label="저장 슬롯">
                <div class="start-slot-modal${startSlotMenuClosing ? " is-closing" : ""}" data-action="keep-start-slots">
                  <p class="start-menu-label">저장 슬롯</p>
                  <div class="start-slot-list">
                    ${slots
                      .map(({ slot, data }) => {
                        const summary = formatSaveSlot(data);
                        return `
                          <button type="button" class="save-slot-row start-slot-row" data-action="load-slot" data-slot="${slot}" ${data ? "" : "disabled"}>
                            <span>슬롯 ${slot}</span>
                            <strong>${escapeHtml(summary.primary)}</strong>
                            <small>${escapeHtml(summary.secondary)}</small>
                          </button>
                        `;
                      })
                      .join("")}
                  </div>
                  <button type="button" class="start-menu-button is-danger" data-action="clear-save" ${hasSave ? "" : "disabled"}>
                    <span class="start-menu-text">저장 삭제</span>
                  </button>
                </div>
              </aside>`
            : ""
        }
      </main>
    `;
    startMessage = "";
  }

  function renderIntro() {
    const total = DATA.introLines?.length || 0;
    const isTutorialPrompt = introMode === "tutorialPrompt";
    const showTutorialChoices = isTutorialPrompt && !introTimer && introText === INTRO_TUTORIAL_PROMPT;
    app.innerHTML = `
      <main class="intro-screen" ${showTutorialChoices ? "" : 'data-action="advance-intro"'}>
        ${isTutorialPrompt ? "" : `<button type="button" class="intro-skip" data-action="skip-intro">스킵</button>`}
        <section class="intro-panel ${showTutorialChoices ? "is-choice-ready" : ""}" aria-label="다윈 프롤로그">
          <p class="intro-line">
            <span data-intro-text>${escapeHtml(introText)}</span><span class="intro-cursor" aria-hidden="true"></span>
          </p>
          ${
            showTutorialChoices
              ? `
                <div class="intro-choice-actions" aria-label="튜토리얼 선택">
                  <button type="button" class="intro-choice-button" data-action="tutorial-yes">예</button>
                  <button type="button" class="intro-choice-button" data-action="tutorial-no">아니오</button>
                </div>
              `
              : `<p class="intro-hint">${isTutorialPrompt ? "Enter / Space / Click" : `${introLineIndex + 1}/${total} · Enter / Space / Click`}</p>`
          }
        </section>
      </main>
    `;
  }

  function renderTutorial() {
    const scene = playableScenes[0] || DATA.scenes[0];
    const step = tutorialSteps[tutorialStepIndex] || tutorialSteps[tutorialSteps.length - 1];
    const backgroundImage = DATA.images[scene.background] || DATA.images.harborStudy;
    const highlight = (target) => (step.target === target ? " is-highlight" : "");
    preloadImage(backgroundImage);

    app.innerHTML = `
      <main class="vn-shell tutorial-shell" data-action="advance-tutorial">
        <section class="vn-stage tutorial-stage">
          <img class="vn-bg" src="${backgroundImage}" alt="${escapeHtml(scene.title)} 배경" loading="eager" decoding="async" fetchpriority="high">
          <div class="tutorial-vignette"></div>
          <header class="vn-topbar tutorial-topbar">
            <div class="tutorial-target tutorial-meta-target${highlight("meta")}">
              <p>${escapeHtml(scene.year)} · ${escapeHtml(scene.location)}</p>
              <h1>${escapeHtml(scene.title)}</h1>
            </div>
            <nav class="vn-actions tutorial-actions" aria-label="게임 메뉴 예시">
              <button type="button" class="tutorial-target${highlight("stats")}">능력치</button>
              <button type="button" class="tutorial-target${highlight("notes")}">노트</button>
              <button type="button" class="tutorial-target${highlight("back")}">뒤로가기</button>
              <button type="button" class="tutorial-target${highlight("save")}">저장</button>
              <button type="button" class="tutorial-target${highlight("load")}">불러오기</button>
              <button type="button" class="tutorial-target${highlight("exit")}">나가기</button>
            </nav>
          </header>
          <section class="tutorial-copy ${step.target === "final" ? "is-final" : ""}">
            <p>${formatTutorialText(step.text)}</p>
            <span>Enter / Space / Click</span>
          </section>
        </section>
      </main>
    `;
  }

  function renderHelp() {
    app.innerHTML = `
      <main class="plain-screen gallery-screen help-screen">
        <section class="plain-panel wide gallery-panel help-panel">
          <div class="gallery-header">
            <div>
              <p class="eyebrow">도움말</p>
              <h1>관찰, 선택, 기록</h1>
            </div>
            <button type="button" class="secondary-button help-reset-button" data-action="open-reset-confirm">초기화 하기</button>
          </div>
          <div class="help-grid">
            <article>
              <h2>진행</h2>
              <p>엔터·스페이스·클릭으로 이야기를 진행합니다. 선택에 따라 사건, 등장인물, 엔딩이 달라집니다. 일부 장면에서는 설득과 추리가 필요합니다.</p>
            </article>
            <article>
              <h2>능력치와 기록</h2>
              <p>행동에 따라 능력치가 변합니다. 과학적 판단을 중시할지, 인간적인 선택을 할지에 따라 이야기 흐름이 달라집니다. 조사 중 얻은 정보와 단서는 노트에 자동 기록됩니다.</p>
            </article>
            <article>
              <h2>AI대화</h2>
              <p>특정 인물과의 대화에서는 AI 설득 시스템이 활성화됩니다. 감정, 논리, 증거를 활용해 상대를 설득해야 합니다. 답변 내용에 따라 호감도와 결과가 달라집니다.</p>
            </article>
            <article>
              <h2>저장과 이어하기</h2>
              <p>게임 중 현재 진행 상황을 저장할 수 있습니다. 저장된 항해 기록은 시작 화면의 ‘이어하기’에서 다시 불러올 수 있습니다.</p>
            </article>
            <article>
              <h2>뒤로가기</h2>
              <p>직전 선택이나 대사 전으로 돌아갈 수 있습니다. 중요한 결정을 다시 고민하거나 기록과 능력치를 확인하고 다른 선택지를 시험해볼 때 사용할 수 있습니다.</p>
            </article>
            <article>
              <h2>엔딩 갤러리</h2>
              <p>도달한 엔딩은 갤러리에 기록됩니다. 해금한 엔딩의 이미지와 설명을 언제든 다시 확인할 수 있습니다.</p>
            </article>
          </div>
          <div class="panel-actions">
            <button type="button" class="secondary-button" data-action="back-start">뒤로가기</button>
          </div>
        </section>
        ${
          resetConfirmOpen
            ? `<aside class="reset-confirm-overlay" data-action="close-reset-confirm" aria-label="초기화 확인">
                <section class="reset-confirm-dialog" data-action="keep-reset-confirm" role="dialog" aria-modal="true" aria-labelledby="reset-confirm-title">
                  <p class="eyebrow">초기화</p>
                  <h2 id="reset-confirm-title">정말 삭제하시겠습니까?</h2>
                  <p>저장 슬롯과 엔딩 갤러리 해금 정보가 모두 삭제됩니다.</p>
                  <div class="reset-confirm-actions">
                    <button type="button" class="secondary-button reset-delete-button" data-action="confirm-reset-all">삭제하기</button>
                    <button type="button" class="ghost-button reset-cancel-button" data-action="close-reset-confirm">취소</button>
                  </div>
                </section>
              </aside>`
            : ""
        }
      </main>
    `;
  }

  function renderGallery(options = {}) {
    const unlocked = getUnlockedEndings();
    const previewEnding = galleryPreviewEndingId && unlocked[galleryPreviewEndingId] ? DATA.endings[galleryPreviewEndingId] : null;
    const previewImage = previewEnding ? DATA.images[previewEnding.image] || previewEnding.image || DATA.images.londonStudy : "";
    app.innerHTML = `
      <main class="plain-screen gallery-screen">
        <section class="plain-panel wide gallery-panel">
          <div class="gallery-header">
            <div>
              <p class="eyebrow">엔딩 갤러리</p>
              <h1>발견한 항해의 결말</h1>
            </div>
            <p>${Object.keys(unlocked).filter((id) => DATA.endings[id]).length}/${getGalleryEndings().length}</p>
          </div>
          <div class="gallery-grid">
            ${getGalleryEndings()
              .map(([id, ending], index) => {
                const isUnlocked = Boolean(unlocked[id]);
                const endingImage = DATA.images[ending.image] || ending.image || DATA.images.londonStudy;
                const label = `${String(index + 1).padStart(2, "0")} · ${isUnlocked ? `해금 - ${formatEndingKind(ending)}` : "잠김"}`;
                const title = formatEndingTitle(ending);
                const tagName = isUnlocked ? "button" : "article";
                const actionAttrs = isUnlocked ? `type="button" data-action="view-gallery-ending" data-ending-id="${escapeHtml(id)}"` : "";
                return `
                  <${tagName} class="ending-tile ${isUnlocked ? "unlocked" : "locked"}" ${actionAttrs}>
                    <figure>
                      ${
                        isUnlocked
                          ? `<img src="${endingImage}" alt="${escapeHtml(ending.title)} 삽화">`
                          : `<div class="locked-art">?</div>`
                      }
                    </figure>
                    <div>
                      ${
                        isUnlocked
                          ? `<span>${escapeHtml(label)}</span><h2>${escapeHtml(title)}</h2>`
                          : `<span>${escapeHtml(label)}</span><h2>???</h2>`
                      }
                    </div>
                  </${tagName}>
                `;
              })
              .join("")}
          </div>
          <div class="panel-actions">
            <button type="button" class="secondary-button" data-action="back-start">뒤로가기</button>
          </div>
        </section>
        ${
          previewEnding
            ? `<aside class="gallery-preview-overlay" data-action="close-gallery-preview" aria-label="엔딩 크게 보기">
                <section class="gallery-preview-modal" data-action="keep-gallery-preview">
                  <figure>
                    <img src="${previewImage}" alt="${escapeHtml(previewEnding.title)} 삽화">
                  </figure>
                  <div class="gallery-preview-copy">
                    <p>${escapeHtml(formatEndingKind(previewEnding))}</p>
                    <h2>${escapeHtml(formatEndingTitle(previewEnding))}</h2>
                    <div class="gallery-preview-lines">
                      ${previewEnding.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
                    </div>
                    <p class="gallery-preview-advice">${escapeHtml(previewEnding.advice)}</p>
                  </div>
                  <button type="button" class="gallery-preview-close" data-action="close-gallery-preview">닫기</button>
                </section>
              </aside>`
            : ""
        }
      </main>
    `;
    if (Number.isFinite(options.restoreScrollTop)) {
      const grid = app.querySelector(".gallery-grid");
      if (grid) grid.scrollTop = options.restoreScrollTop;
      requestAnimationFrame(() => {
        const nextGrid = app.querySelector(".gallery-grid");
        if (nextGrid) nextGrid.scrollTop = options.restoreScrollTop;
      });
    }
  }

  function renderGame() {
    if (!state) {
      renderStart();
      return;
    }

    const scene = sceneById.get(state.sceneId);
    const beat = getCurrentBeat(scene);
    const showChoices = choicesVisible(scene);
    const showAgentChat = showChoices && isAgentScene(scene.id);
    const showAgentChallengeIntro = armAgentChallengeIntro(scene.id, showAgentChat);
    const canShowAgentChat = showAgentChat && !showAgentChallengeIntro;
    armTimedChoice(scene, showChoices && !showAgentChat);
    const showOutcomeCast = !canShowAgentChat && Array.isArray(state.choiceOutcome?.cast) && state.choiceOutcome.cast.length;
    const speaker = !showOutcomeCast && !showAgentChat && (beat?.type === "speaker" || beat?.type === "outcome" || showChoices) ? speakerMeta[scene.id] : null;
    const outcomeBackground = state.choiceOutcome?.background ? DATA.images[state.choiceOutcome.background] : "";
    const sceneBackground = DATA.images[getSceneBackgroundKey(scene)] || DATA.images[scene.background];
    const backgroundImage = outcomeBackground || (showAgentChat ? getAgentBackground(scene.id) || sceneBackground : sceneBackground);
    const sceneClass = `scene-${scene.id.replace(/[^a-z0-9_-]/gi, "-")}`;
    const characterLayoutKey = getCharacterLayoutKey(showOutcomeCast, speaker);
    const suppressCharacterFade =
      currentCharacterSceneId === scene.id &&
      currentCharacterLayoutKey === characterLayoutKey &&
      currentBackgroundImage === backgroundImage;
    const preserveBackground = currentBackgroundImage === backgroundImage;
    const previousBackground = preserveBackground ? app.querySelector(".vn-bg")?.cloneNode(false) : null;
    if (previousBackground) previousBackground.alt = `${scene.title} 배경`;
    preloadImage(backgroundImage);
    preloadSceneAssets(scene);

    app.innerHTML = `
      <main class="vn-shell">
        <section class="vn-stage ${sceneClass} ${showAgentChat ? "agent-stage" : ""} ${suppressCharacterFade ? "no-character-fade" : ""}">
          <img class="vn-bg" src="${backgroundImage}" alt="${escapeHtml(scene.title)} 배경" loading="eager" decoding="async" fetchpriority="high">
          <div class="vn-vignette"></div>
          <header class="vn-topbar">
            <div>
              <p>${escapeHtml(scene.year)} · ${escapeHtml(scene.location)}</p>
              <h1>${escapeHtml(scene.title)}</h1>
            </div>
            <nav class="vn-actions" aria-label="게임 메뉴">
              <button type="button" data-action="toggle-stats">능력치</button>
              <button type="button" data-action="toggle-notes">노트</button>
              <button type="button" data-action="back" ${canGoBack() ? "" : "disabled"}>뒤로가기</button>
              <button type="button" data-action="save">저장</button>
              <button type="button" data-action="load">불러오기</button>
              <button type="button" data-action="back-start">나가기</button>
            </nav>
          </header>

          <div class="route-dots vn-route" style="--route-count: ${playableScenes.length}">${renderRouteDots(scene.id)}</div>
          ${showOutcomeCast ? renderConversationCast(state.choiceOutcome) : speaker ? renderSpeakerFocus(speaker) : ""}
          ${state.flash ? `<div class="stat-toast save-toast">${escapeHtml(state.flash)}</div>` : ""}
          ${state.effectToast ? `<div class="stat-toast">${escapeHtml(state.effectToast)}</div>` : ""}
          ${state.showStats ? renderStatsOverlay() : ""}
          ${state.showNotes ? renderNotesOverlay() : ""}
          ${state.saveSlotMode ? renderSaveSlotPanel(state.saveSlotMode) : ""}
          ${state.challengeComplete ? renderChallengeComplete(state.challengeComplete) : ""}
          ${canShowAgentChat ? renderAgentChat(scene) : ""}
          ${!showAgentChat && showChoices ? renderChoices(scene) : ""}
          ${!showAgentChat ? renderDialogue(scene, beat, showChoices) : ""}
        </section>
      </main>
    `;
    currentBackgroundImage = backgroundImage;
    currentCharacterSceneId = scene.id;
    currentCharacterLayoutKey = characterLayoutKey;
    if (previousBackground) {
      const backgroundNode = app.querySelector(".vn-bg");
      if (backgroundNode) backgroundNode.replaceWith(previousBackground);
    }
    state.flash = "";
    if (canShowAgentChat) {
      focusAgentInputSoon();
    }
  }

  function focusAgentInputSoon() {
    window.setTimeout(() => {
      const field = app.querySelector("[data-agent-input]:not(:disabled)");
      if (field && document.activeElement !== field) {
        field.focus();
      }
    }, 0);
  }

  function renderRouteDots(sceneId) {
    const currentProgress = getPlayableProgress(sceneId);
    return playableScenes
      .map((scene) => {
        const progress = getPlayableProgress(scene.id);
        const status = progress < currentProgress ? "done" : progress === currentProgress ? "current" : "";
        return `<span class="${status}" title="${escapeHtml(scene.location)}"></span>`;
      })
      .join("");
  }

  function renderChallengeComplete(challenge) {
    const modeClass = challenge.mode === "complete" ? " is-complete" : " is-intro";
    const statusClass = challenge.status ? " has-status" : "";
    return `
      <aside class="challenge-complete${modeClass}${statusClass}" aria-live="polite">
        <div class="challenge-band">
          <p><img src="${escapeHtml(DATA.images.challengeLogo)}" alt="" aria-hidden="true">${escapeHtml(challenge.eyebrow || "대화형 챌린지")}</p>
          <div class="challenge-title-anchor">
            <h2>${escapeHtml(challenge.title || "챌린지")}</h2>
            ${challenge.corner ? `<div class="challenge-corner">${escapeHtml(challenge.corner)}</div>` : ""}
          </div>
          ${challenge.status ? `<strong>${escapeHtml(challenge.status)}</strong>` : ""}
        </div>
      </aside>
    `;
  }

  function getCharacterLayoutKey(showOutcomeCast, speaker) {
    if (showOutcomeCast && Array.isArray(state.choiceOutcome?.cast)) {
      const actors = state.choiceOutcome.cast
        .map((actor) =>
          [actor.id || "", actor.portrait || "", actor.side || "", actor.flipped ? "flipped" : "", actor.variant || ""].join(":")
        )
        .join("|");
      return `cast:${actors}`;
    }
    if (speaker) return `speaker:${resolveSpeakerPortrait(speaker)}`;
    return "none";
  }

  function resolveSpeakerPortrait(speaker) {
    if (!speaker || speaker.portrait !== "darwin") return speaker?.portrait || "";
    const scene = sceneById.get(state?.sceneId);
    const year = Number.parseInt(String(scene?.year || "").match(/\d{4}/)?.[0] || "0", 10);
    if (state?.sceneId === "publish-origin" || year >= 1859) return "darwin-elder";
    if (year >= 1838) return "darwin-mature";
    return "darwin";
  }

  function renderSpeakerFocus(speaker) {
    const portrait = resolveSpeakerPortrait(speaker);
    const portraitImageKey = {
      "darwin-mature": "darwinMaturePortrait",
      "darwin-elder": "darwinElderPortrait",
    }[portrait];
    const portraitImage = portraitImageKey ? DATA.images[portraitImageKey] : DATA.images.speakerSheet;
    const portraitClass = portraitImageKey ? " character-sprite-standalone" : "";
    return `
      <div
        class="character-sprite${portraitClass} speaker-${escapeHtml(portrait)}"
        style="background-image: url('${portraitImage}')"
        aria-hidden="true"
      ></div>
    `;
  }

  function renderConversationCast(outcome) {
    const activeSpeaker = outcome?.speaker || outcome?.portrait || "";
    const actors = Array.isArray(outcome?.cast) ? outcome.cast : [];
    if (!actors.length) return "";
    return `
      <div class="conversation-cast" aria-hidden="true">
        ${actors
          .map((actor) => {
            const portrait = actor.portrait || actor.id || "";
            const actorId = actor.id || portrait;
            const isActive = activeSpeaker && (activeSpeaker === actorId || activeSpeaker === portrait);
            const classes = [
              "character-sprite",
              "conversation-actor",
              `speaker-${classToken(portrait)}`,
              `actor-${classToken(actor.side || "right")}`,
              isActive ? "active" : "inactive",
              actor.flipped ? "flipped" : "",
              actor.variant ? `variant-${classToken(actor.variant)}` : "",
            ]
              .filter(Boolean)
              .join(" ");
            return `<div class="${classes}" style="background-image: url('${DATA.images.speakerSheet}')"></div>`;
          })
          .join("")}
      </div>
    `;
  }

  function renderDialogue(scene, beat, showChoices) {
    const speakerLabel = beat?.type === "speaker" || beat?.type === "outcome" ? beat.name : "관찰 노트";
    const roleLabel = beat?.type === "speaker" || beat?.type === "outcome" ? beat.role : `${scene.year} · ${scene.location}`;
    const line = showChoices ? "어떻게 답할까?" : beat?.text || "";
    const note = !showChoices && beat?.note ? String(beat.note) : "";
    const hint = showChoices ? "선택지를 고르세요" : state.pendingTransition ? "엔터/스페이스로 계속" : "엔터/스페이스 또는 클릭으로 계속";
    const speakerClass = beat?.speaker ? ` dialogue-speaker-${classToken(beat.speaker)}` : "";
    return `
      <article class="vn-dialogue${speakerClass}" data-action="${showChoices ? "" : "advance"}">
        <div>
          <p class="speaker-name">${escapeHtml(speakerLabel)}</p>
          <p class="speaker-role">${escapeHtml(roleLabel)}</p>
        </div>
        <div class="spoken-copy">
          <p class="spoken-line">${beat?.type === "speaker" && !showChoices ? "“" : ""}${escapeHtml(line)}${beat?.type === "speaker" && !showChoices ? "”" : ""}</p>
          ${note ? `<small class="spoken-note">${escapeHtml(note)}</small>` : ""}
        </div>
        <span class="continue-hint">${escapeHtml(hint)}</span>
      </article>
    `;
  }

  function renderStatsOverlay() {
    return `
      <aside class="hud-panel">
        <div class="hud-heading">
          <strong>능력치</strong>
          <button type="button" data-action="toggle-stats">닫기</button>
        </div>
        ${renderStats()}
        <div class="stat-hint">
          <p><strong>출판 가능</strong> 과학적 성취도 16 이상</p>
          <p><strong>진엔딩</strong> 인류애적 통찰력 15 이상</p>
        </div>
      </aside>
    `;
  }

  function renderNotesOverlay() {
    const activeTab = DATA.noteTabs.find((tab) => tab.id === state.noteTab) || DATA.noteTabs[0];
    return `
      <aside class="hud-panel notes-hud">
        <div class="hud-heading">
          <strong>관찰 노트</strong>
          <button type="button" data-action="toggle-notes">닫기</button>
        </div>
        <div class="note-tabs">
          ${DATA.noteTabs
            .map(
              (tab) => `
                <button type="button" class="${tab.id === activeTab.id ? "active" : ""}" data-action="note-tab" data-tab="${tab.id}">
                  ${escapeHtml(tab.label)}
                </button>
              `,
            )
            .join("")}
        </div>
        <div class="note-list">${renderNotes(activeTab.id)}</div>
      </aside>
    `;
  }

  function renderSaveSlotPanel(mode) {
    const isSaveMode = mode === "save";
    return `
      <aside class="hud-panel save-slot-hud">
        <div class="hud-heading">
          <strong>${isSaveMode ? "저장 슬롯 선택" : "불러오기 슬롯 선택"}</strong>
          <button type="button" data-action="close-save-slots">닫기</button>
        </div>
        <div class="save-slot-list">
          ${getSaveSlots()
            .map(({ slot, data }) => {
              const summary = formatSaveSlot(data);
              const disabled = !isSaveMode && !data;
              return `
                <button type="button" class="save-slot-row" data-action="${isSaveMode ? "save-slot" : "load-slot"}" data-slot="${slot}" ${disabled ? "disabled" : ""}>
                  <span>슬롯 ${slot}</span>
                  <strong>${escapeHtml(summary.primary)}</strong>
                  <small>${escapeHtml(summary.secondary)}</small>
                </button>
              `;
            })
            .join("")}
        </div>
      </aside>
    `;
  }

  function renderStats() {
    return Object.entries(DATA.statGroups)
      .map(
        ([, keys]) => `
          <div class="stat-group">
            ${keys
              .map((key) => {
                const value = getScore(state.stats, key);
                const barValue = Math.max(0, Math.min(100, value * 5));
                return `
                  <div class="stat-row">
                    <span>${escapeHtml(DATA.statLabels[key])}</span>
                    <strong>${value > 0 ? "+" : ""}${value}</strong>
                    <i style="--stat-width: ${barValue}%"></i>
                  </div>
                `;
              })
              .join("")}
          </div>
        `,
      )
      .join("");
  }

  function renderNotes(tabId) {
    const notes = state.notes[tabId] || [];
    if (!notes.length) {
      return `<p class="empty-note">아직 기록이 없습니다.</p>`;
    }
    return `<ul>${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>`;
  }

  function renderAgentChat(scene) {
    const config = agentSceneConfigs[scene.id];
    const chat = ensureAgentChat(scene.id);
    const draft = state.agentDrafts?.[scene.id] || "";
    const canShowLetter = scene.id === "shrewsbury-family" && DATA.wedgwoodLetter;
    const letterLines = DATA.wedgwoodLetter?.full || [];
    const letterPages = getLetterPages(letterLines);
    const letterPage = Math.max(0, Math.min(letterPages.length - 1, Number(state.letterPage) || 0));
    const verdictText =
      chat.verdict === "success"
        ? `${config.targetLabel}의 허락을 얻었습니다.`
        : chat.verdict === "failure"
          ? `${config.targetLabel}의 신뢰를 얻지 못했습니다.`
          : "";

    return `
      <section class="agent-chat-panel${state.showLetter ? " has-letter-open" : ""}" aria-label="${escapeHtml(config.targetLabel)}와의 대화">
        <div class="agent-chat-head">
          <div>
            <p>${escapeHtml(config.targetName)}</p>
            <h2>${escapeHtml(config.targetLabel)}와 대화하기</h2>
            ${canShowLetter ? `<button type="button" class="agent-key-button letter-toggle-inline" data-action="toggle-letter">${state.showLetter ? "편지 닫기" : "편지 보기"}</button>` : ""}
          </div>
          <div class="agent-score" aria-label="호감도 ${chat.score}점">
            <b>호감도</b>
            <span>${chat.score}</span>
            <i style="--agent-score: ${Math.max(0, Math.min(100, chat.score))}%"></i>
          </div>
        </div>

        ${
          canShowLetter && state.showLetter
            ? `
              <div class="letter-backdrop" data-action="close-letter" aria-hidden="true"></div>
              <aside class="letter-panel" role="dialog" aria-label="조시아 웨지우드의 편지">
                <div class="letter-paper">
                  <div class="letter-body">${formatLetterBody(letterPages[letterPage] || [])}</div>
                  <div class="letter-controls">
                    <button type="button" data-action="letter-prev" ${letterPage <= 0 ? "disabled" : ""}>이전</button>
                    <span>${letterPage + 1} / ${letterPages.length}</span>
                    <button type="button" data-action="letter-next" ${letterPage >= letterPages.length - 1 ? "disabled" : ""}>다음</button>
                  </div>
                </div>
              </aside>
            `
            : ""
        }

        <div class="agent-log">
          ${chat.messages
            .map(
              (message) => `
                <article class="agent-message ${message.role}">
                  <span>${message.role === "player" ? escapeHtml(config.playerLabel) : escapeHtml(config.targetLabel)}</span>
                  <p>${escapeHtml(message.text)}</p>
                </article>
              `,
            )
            .join("")}
          ${chat.pending ? `<article class="agent-message agent"><span>${escapeHtml(config.targetLabel)}</span><p>생각하는 중...</p></article>` : ""}
          ${verdictText ? `<article class="agent-message system"><span>판정</span><p>${escapeHtml(verdictText)}</p></article>` : ""}
          ${chat.error ? `<article class="agent-message system error"><span>오류</span><p>${escapeHtml(chat.error)}</p></article>` : ""}
        </div>

        <form class="agent-input" data-agent-form data-scene="${escapeHtml(scene.id)}">
          <textarea
            data-agent-input
            data-scene="${escapeHtml(scene.id)}"
            placeholder="${escapeHtml(config.targetLabel)}에게 어떻게 말할까?"
            enterkeyhint="send"
            ${chat.pending || chat.locked ? "disabled" : ""}
          >${escapeHtml(draft)}</textarea>
          <button type="submit" ${chat.pending || chat.locked ? "disabled" : ""}>전송</button>
        </form>
      </section>
    `;
  }

  function renderChoices(scene) {
    const timed = Boolean(scene.timeLimitSeconds && state.timedChoiceSceneId === scene.id);
    const remaining = timed ? Math.max(0, state.timedChoiceRemaining || Number(scene.timeLimitSeconds) || 5) : 0;
    const total = timed ? Math.max(1, Number(scene.timeLimitSeconds) || 5) : 1;
    const progress = Math.max(0, Math.min(100, (remaining / total) * 100));
    return `
      <div class="vn-choice-panel">
        ${
          timed
            ? `
              <div class="timed-choice-timer" data-timed-choice-timer aria-label="남은 시간 ${remaining}초">
                <span>남은 시간</span>
                <strong data-timed-choice-count>${remaining}</strong>
                <i data-timed-choice-bar style="--timer-progress: ${progress}%"></i>
              </div>
            `
            : ""
        }
        ${getDisplayChoices(scene)
          .map((choice) => {
            const reply = choiceReplies[choice.id] || choice.label;
            return `
              <button type="button" class="vn-choice" data-action="choice" data-choice="${choice.id}">
                <strong>${escapeHtml(reply)}</strong>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function getEndingScreenEyebrow(ending) {
    return String(ending?.title || "")
      .split(/[:：]/)[0]
      .trim() || "엔딩";
  }

  function getEndingScreenTitle(ending) {
    return String(ending?.title || "")
      .replace(/^[^:：]+[:：]\s*/, "")
      .trim();
  }

  function renderEnding() {
    const ending = DATA.endings[state?.endingId] || DATA.endings.unfinishedManuscript;
    const endingImage = DATA.images[ending.image] || ending.image || DATA.images.londonStudy;

    app.innerHTML = `
      <main class="ending-screen">
        <section class="ending-split-panel">
          <figure class="ending-art" style="--ending-image: url('${escapeHtml(cssAssetUrl(endingImage))}')">
            <img src="${endingImage}" alt="${escapeHtml(ending.title)} 삽화">
          </figure>
          <div class="ending-copy">
            <p class="eyebrow">${escapeHtml(getEndingScreenEyebrow(ending))}</p>
            <h1>${escapeHtml(getEndingScreenTitle(ending))}</h1>
            <div class="ending-lines">
              ${ending.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
            </div>
            <p class="advice">${escapeHtml(ending.advice)}</p>
            <div class="start-actions">
              <button type="button" class="primary-button" data-action="restart">처음부터</button>
              <button type="button" class="secondary-button" data-action="gallery">엔딩 갤러리</button>
              <button type="button" class="ghost-button" data-action="back-start">시작 화면</button>
            </div>
          </div>
        </section>
      </main>
    `;
  }

  function renderLoading() {
    const loading = state?.loadingTransition || voyageLoadingMessage("fitzroy-interview");
    const loadingImage = DATA.images[loading.image] || DATA.images.voyageLoading || DATA.images.beagleDeck;
    const variant = loading.variant ? ` ${loading.variant}` : "";
    app.innerHTML = `
      <main class="loading-screen${variant}" style="--loading-duration: ${Number(loading.duration || 2000)}ms">
        <img src="${loadingImage}" alt="바다 위 비글호">
        <div class="loading-scrim"></div>
        <section class="loading-card">
          <p class="eyebrow">${escapeHtml(loading.eyebrow || "항해 중")}</p>
          <h1>${escapeHtml(loading.title)}</h1>
          <p>${escapeHtml(loading.line)}</p>
          <div class="loading-bar" aria-hidden="true"><span></span></div>
        </section>
      </main>
    `;
  }

  function render() {
    syncViewportLayoutVars();
    syncBgm();

    if (view === "intro") {
      renderIntro();
      return;
    }

    if (view === "tutorial") {
      renderTutorial();
      return;
    }

    if (view === "loading" && state) {
      renderLoading();
      return;
    }

    if (view === "help") {
      renderHelp();
      return;
    }

    if (view === "gallery") {
      renderGallery();
      return;
    }

    if (view === "game") {
      renderGame();
      return;
    }

    if (view === "ending" && state) {
      renderEnding();
      return;
    }

    renderStart();
  }

  app.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) {
      if (view === "start") {
        unlockBgm();
        return;
      }
      if (shouldAdvanceFromBlankClick(event)) advanceDialogue();
      return;
    }

    const action = button.dataset.action;
    if (button.disabled) return;
    event.preventDefault();
    if (!(view === "start" && action === "start")) {
      unlockBgm();
    }

    switch (action) {
      case "start":
        closeStartSlots({ immediate: true, render: false });
        beginStartTransition(() => startNewRun());
        return;
      case "advance-intro":
        advanceIntro();
        return;
      case "advance-tutorial":
        advanceTutorial();
        return;
      case "skip-intro":
        skipIntro();
        return;
      case "tutorial-yes":
        beginTutorial();
        return;
      case "tutorial-no":
        startActualRun();
        return;
      case "continue":
        if (view === "start") {
          if (startSlotMenuOpen && !startSlotMenuClosing) {
            closeStartSlots();
          } else {
            openStartSlots();
          }
          return;
        }
        beginStartTransition(() => loadRun());
        return;
      case "close-start-slots":
        closeStartSlots();
        return;
      case "keep-start-slots":
        return;
      case "load":
        if (state) openSaveSlots("load");
        return;
      case "save":
        if (state) openSaveSlots("save");
        return;
      case "save-slot":
        if (state) saveRun(Number(button.dataset.slot));
        return;
      case "load-slot": {
        const slot = Number(button.dataset.slot);
        if (view === "start") {
          closeStartSlots({
            onClosed: () => beginStartTransition(() => loadRun(slot)),
          });
        } else {
          loadRun(slot);
        }
        return;
      }
      case "close-save-slots":
        if (state) {
          state.saveSlotMode = "";
          render();
        }
        return;
      case "back":
        if (state) goBack();
        return;
      case "advance":
        advanceDialogue();
        return;
      case "help":
        closeStartSlots({ immediate: true, render: false });
        galleryPreviewEndingId = "";
        resetConfirmOpen = false;
        view = "help";
        render();
        return;
      case "open-reset-confirm":
        if (view === "help") {
          resetConfirmOpen = true;
          renderHelp();
        }
        return;
      case "close-reset-confirm":
        if (view === "help") {
          resetConfirmOpen = false;
          renderHelp();
        }
        return;
      case "keep-reset-confirm":
        return;
      case "confirm-reset-all":
        if (view === "help") clearAllProgress();
        return;
      case "gallery":
        closeStartSlots({ immediate: true, render: false });
        galleryPreviewEndingId = "";
        resetConfirmOpen = false;
        view = "gallery";
        render();
        return;
      case "view-gallery-ending":
        if (view === "gallery" && DATA.endings[button.dataset.endingId]) {
          const galleryScrollTop = app.querySelector(".gallery-grid")?.scrollTop || 0;
          galleryPreviewEndingId = button.dataset.endingId;
          renderGallery({ restoreScrollTop: galleryScrollTop });
        }
        return;
      case "close-gallery-preview":
        if (view === "gallery") {
          const galleryScrollTop = app.querySelector(".gallery-grid")?.scrollTop || 0;
          galleryPreviewEndingId = "";
          renderGallery({ restoreScrollTop: galleryScrollTop });
        }
        return;
      case "keep-gallery-preview":
        return;
      case "back-start":
        clearStartTransitionTimer();
        clearIntroTimer();
        clearTimedChoiceTimers();
        clearLetterTimer();
        clearChallengeCompleteTimer();
        if (loadingTimer) {
          clearTimeout(loadingTimer);
          loadingTimer = null;
        }
        closeStartSlots({ immediate: true, render: false });
        galleryPreviewEndingId = "";
        resetConfirmOpen = false;
        view = "start";
        render();
        return;
      case "restart":
        unlockIntroSound();
        startNewRun();
        return;
      case "clear-save":
        clearSave();
        return;
      case "toggle-stats":
        if (state) {
          state.showStats = !state.showStats;
          state.showNotes = false;
          state.showLetter = false;
          state.letterPage = 0;
          clearLetterTimer();
          render();
        }
        return;
      case "toggle-notes":
        if (state) {
          state.showNotes = !state.showNotes;
          state.showStats = false;
          state.showLetter = false;
          state.letterPage = 0;
          clearLetterTimer();
          render();
        }
        return;
      case "toggle-letter":
        if (state) {
          clearLetterTimer();
          state.showLetter = !state.showLetter;
          state.letterPage = 0;
          playLetterSlideSound(state.showLetter ? "open" : "close");
          render();
        }
        return;
      case "letter-prev":
        if (state?.showLetter) {
          state.letterPage = Math.max(0, (Number(state.letterPage) || 0) - 1);
          render();
        }
        return;
      case "letter-next":
        if (state?.showLetter) {
          const pages = getLetterPages(DATA.wedgwoodLetter?.full || []);
          state.letterPage = Math.min(pages.length - 1, (Number(state.letterPage) || 0) + 1);
          render();
        }
        return;
      case "close-letter":
        if (state) {
          state.showLetter = false;
          state.letterPage = 0;
          clearLetterTimer();
          playLetterSlideSound("close");
          render();
        }
        return;
      case "note-tab":
        if (state) {
          state.noteTab = button.dataset.tab || "specimens";
          render();
        }
        return;
      case "choice":
        if (state) handleChoice(button.dataset.choice);
        return;
      default:
        return;
    }
  });

  app.addEventListener("input", (event) => {
    const agentField = event.target?.closest?.("[data-agent-input]");
    if (agentField && state) {
      const sceneId = agentField.dataset.scene;
      state.agentDrafts = state.agentDrafts || {};
      state.agentDrafts[sceneId] = agentField.value;
      return;
    }
  });

  app.addEventListener("keydown", (event) => {
    const agentField = event.target?.closest?.("[data-agent-input]");
    if (!agentField || event.key !== "Enter" || event.shiftKey) return;
    if (event.isComposing) return;
    event.preventDefault();
    const sceneId = agentField.dataset.scene;
    state.agentDrafts = state.agentDrafts || {};
    state.agentDrafts[sceneId] = agentField.value;
    handleAgentChatSubmit(sceneId);
  });

  app.addEventListener("submit", (event) => {
    const form = event.target.closest("[data-agent-form]");
    if (!form) return;
    event.preventDefault();
    handleAgentChatSubmit(form.dataset.scene);
  });

  window.addEventListener("keydown", (event) => {
    const isAdvanceKey = event.key === "Enter" || event.key === " " || event.code === "Space";
    if (isAdvanceKey && view === "intro") {
      event.preventDefault();
      if (introMode === "tutorialPrompt" && !introTimer) return;
      advanceIntro();
      return;
    }
    if (isAdvanceKey && view === "tutorial") {
      event.preventDefault();
      advanceTutorial();
      return;
    }
    if (!isAdvanceKey || view !== "game") return;
    if (state?.saveSlotMode || state?.showStats || state?.showNotes) return;
    if (event.target?.closest?.("input, textarea, button")) return;
    event.preventDefault();
    advanceDialogue();
  });

  window.addEventListener("resize", queueViewportLayoutSync);
  window.addEventListener("orientationchange", queueViewportLayoutSync);

  syncViewportLayoutVars();
  preloadImages();
  render();
})();
