export const namePools = {
  first: ["Mara", "Elio", "Sofia", "Nico", "Lia", "Tomas", "Iris", "Paolo", "Mina", "Theo"],
  last: ["Reyes", "Santos", "Garcia", "Navarro", "Cruz", "Mendoza", "Flores", "Ramos"],
  guardianFirst: ["Ana", "Elena", "Maria", "Grace", "Paolo", "Daniel", "Luis", "Marco"],
  friendFirst: ["Maya", "Liam", "Zoe", "Nina", "Eli", "Sam", "Noah", "Aya"],
  siblingFirst: ["Leo", "Mika", "Nina", "Gab", "Tala", "Enzo"],
  grandmotherFirst: ["Lola Cora", "Lola Tess", "Lola Nena", "Lola Mila"],
};

export const places = [
  { city: "Quezon City", country: "Philippines", neighborhood: "Busy", housing: "Small two-bedroom house" },
  { city: "Imus", country: "Philippines", neighborhood: "Growing", housing: "Modest townhouse" },
  { city: "Iloilo City", country: "Philippines", neighborhood: "Quiet", housing: "Two-bedroom apartment" },
  { city: "Cebu City", country: "Philippines", neighborhood: "Busy", housing: "Compact apartment" },
  { city: "Davao City", country: "Philippines", neighborhood: "Residential", housing: "Small family house" },
];

export const eventTemplates = [
  {
    id: "held_after_crying",
    category: "Family",
    age: [0, 1],
    title: "Someone comes when you cry",
    body: "You wake from a nap upset. {guardian.name} picks you up and holds you against their shoulder until the room feels less frightening.",
    prompt: "What do you do?",
    choices: [
      {
        id: "settle",
        label: "Settle against them",
        result: "Your breathing slows. Their voice becomes something familiar in a world that still mostly isn't.",
        effects: [
          { type: "relationship", target: "guardian", key: "trust", delta: 4 },
          { type: "personality", key: "sensitivity", delta: -1 },
        ],
        memory: { importance: 1, title: "Being comforted", copy: "You learned, in a tiny way, that someone might come when you needed them." },
      },
      {
        id: "watch",
        label: "Watch their face quietly",
        result: "You stop crying before you stop staring. Faces are becoming more interesting to you.",
        effects: [
          { type: "personality", key: "curiosity", delta: 3 },
          { type: "relationship", target: "guardian", key: "familiarity", delta: 3 },
        ],
      },
      {
        id: "fuss",
        label: "Keep fussing",
        result: "It takes longer this time. Eventually you tire yourself out in their arms.",
        effects: [
          { type: "personality", key: "sensitivity", delta: 2 },
          { type: "relationship", target: "guardian", key: "familiarity", delta: 2 },
        ],
      },
    ],
  },
  {
    id: "cupboard_discovery",
    category: "Home",
    age: [1, 3],
    title: "The kitchen cupboard",
    body: "A cupboard door has been left slightly open. Inside are metal bowls, a wooden spoon, and several things that make excellent noises when dropped.",
    prompt: "What catches your attention?",
    choices: [
      {
        id: "noise",
        label: "Bang the bowls together",
        result: "The sound is magnificent. The adults in the room appear to hold a different opinion.",
        effects: [
          { type: "personality", key: "curiosity", delta: 4 },
          { type: "personality", key: "structure", delta: -2 },
          { type: "interest", key: "music", delta: 3 },
        ],
      },
      {
        id: "stack",
        label: "Try stacking the bowls",
        result: "The bowls fit inside one another. You repeat the trick until it feels obvious, which is how learning tends to disguise itself.",
        effects: [
          { type: "personality", key: "curiosity", delta: 3 },
          { type: "personality", key: "structure", delta: 2 },
          { type: "interest", key: "making", delta: 3 },
        ],
      },
      {
        id: "leave",
        label: "Leave it alone",
        result: "You look, decide the cupboard isn't worth the trouble, and wander toward something more familiar.",
        effects: [{ type: "personality", key: "risk", delta: -2 }],
      },
    ],
  },
  {
    id: "playground_edge",
    category: "Self",
    age: [2, 5],
    title: "At the edge of the playground",
    body: "Several children are chasing one another. You are close enough to join them, but nobody has asked you yet.",
    prompt: "What do you do?",
    choices: [
      {
        id: "join",
        label: "Run into the game",
        result: "For a while nobody seems to mind that you simply appeared. Soon you are running as if you had always been there.",
        effects: [
          { type: "personality", key: "social", delta: 4 },
          { type: "personality", key: "risk", delta: 2 },
        ],
      },
      {
        id: "watch_first",
        label: "Watch until you understand the game",
        result: "You spend several minutes learning the rules before deciding whether the game is worth joining.",
        effects: [
          { type: "personality", key: "social", delta: -1 },
          { type: "personality", key: "structure", delta: 3 },
          { type: "personality", key: "curiosity", delta: 2 },
        ],
      },
      {
        id: "stay_close",
        label: "Stay near your guardian",
        result: "You remain where things are predictable. The noise of the playground feels easier from here.",
        effects: [
          { type: "personality", key: "social", delta: -2 },
          { type: "relationship", target: "guardian", key: "closeness", delta: 2 },
        ],
      },
    ],
  },
  {
    id: "drawing_on_scrap",
    category: "Interests",
    age: [3, 7],
    title: "A box of old paper",
    body: "There is a stack of scrap paper on the table and a cup of pens beside it. Nobody seems to be using either.",
    prompt: "What do you make?",
    choices: [
      {
        id: "draw_home",
        label: "Draw your home",
        result: "The windows come out crooked and everyone is much too tall. You like it anyway.",
        effects: [
          { type: "interest", key: "drawing", delta: 8 },
          { type: "interest", key: "making", delta: 3 },
          { type: "personality", key: "curiosity", delta: 2 },
        ],
        memory: { importance: 2, title: "Drawing at the table", copy: "You spent an afternoon filling scrap paper with crooked little pictures." },
      },
      {
        id: "write_shapes",
        label: "Copy letters and shapes",
        result: "You copy the same shapes again and again, making each one a little neater than the last.",
        effects: [
          { type: "personality", key: "structure", delta: 4 },
          { type: "education", key: "language", delta: 3 },
        ],
      },
      {
        id: "fold",
        label: "Fold the paper into things",
        result: "Most of the shapes do not resemble what you intended. One of them looks enough like a boat to count.",
        effects: [
          { type: "interest", key: "making", delta: 7 },
          { type: "personality", key: "curiosity", delta: 3 },
        ],
      },
    ],
  },
  {
    id: "sibling_toy",
    category: "Family",
    age: [3, 7],
    requirements: { hasSibling: true },
    title: "The toy both of you want",
    body: "{sibling.name} has the toy you wanted to use. They are not giving it up voluntarily. Diplomacy has reached its first great test.",
    prompt: "What do you do?",
    choices: [
      {
        id: "ask",
        label: "Ask for a turn",
        result: "It takes some negotiation, but eventually the toy changes hands without anyone screaming.",
        effects: [
          { type: "relationship", target: "sibling", key: "trust", delta: 3 },
          { type: "personality", key: "structure", delta: 2 },
        ],
      },
      {
        id: "grab",
        label: "Grab it",
        result: "You get the toy for approximately four seconds. The household gets an argument for considerably longer.",
        effects: [
          { type: "relationship", target: "sibling", key: "conflict", delta: 5 },
          { type: "personality", key: "risk", delta: 2 },
          { type: "personality", key: "structure", delta: -2 },
        ],
      },
      {
        id: "other",
        label: "Find something else",
        result: "You decide the battle is not worth it. A different toy becomes interesting enough after a minute.",
        effects: [
          { type: "personality", key: "independence", delta: 3 },
          { type: "relationship", target: "sibling", key: "conflict", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "first_school_day",
    category: "School",
    age: [5, 6],
    title: "First day of school",
    body: "The classroom smells like paper, floor wax, and somebody else's lunch. Your teacher, {teacher.name}, asks everyone to choose a seat.",
    prompt: "Where do you sit?",
    choices: [
      {
        id: "front",
        label: "Near the front",
        result: "You can hear everything clearly. Being visible is uncomfortable, but useful.",
        effects: [
          { type: "personality", key: "social", delta: 1 },
          { type: "education", key: "language", delta: 2 },
          { type: "education", key: "mathematics", delta: 2 },
        ],
        memory: { importance: 3, title: "First day of school", copy: "You were nervous, but the classroom slowly became less strange." },
      },
      {
        id: "friendly",
        label: "Beside someone who smiles at you",
        result: "Their name is {friend.name}. By lunchtime, you have already exchanged several pieces of extremely important childhood information.",
        effects: [
          { type: "relationship", target: "friend", key: "closeness", delta: 7 },
          { type: "relationship", target: "friend", key: "familiarity", delta: 5 },
          { type: "personality", key: "social", delta: 3 },
        ],
        memory: { importance: 3, title: "Meeting {friend.name}", copy: "You sat beside {friend.name} on one of your first days at school." },
      },
      {
        id: "back",
        label: "Somewhere quiet at the back",
        result: "From here you can watch the room without feeling as watched yourself.",
        effects: [
          { type: "personality", key: "social", delta: -2 },
          { type: "personality", key: "curiosity", delta: 2 },
        ],
      },
    ],
  },
  {
    id: "lunch_friend",
    category: "Friends",
    age: [6, 10],
    title: "A seat at lunch",
    body: "{friend.name} waves you over at lunch. There is one empty seat beside them, and another group from class is sitting nearby.",
    prompt: "Where do you go?",
    choices: [
      {
        id: "friend",
        label: "Sit with {friend.name}",
        result: "You spend lunch laughing about something that will be almost impossible to explain later.",
        effects: [
          { type: "relationship", target: "friend", key: "closeness", delta: 5 },
          { type: "relationship", target: "friend", key: "trust", delta: 2 },
        ],
      },
      {
        id: "new_group",
        label: "Try the other group",
        result: "The first few minutes are awkward. Then somebody asks you a question and the table starts feeling less closed.",
        effects: [
          { type: "personality", key: "social", delta: 4 },
          { type: "personality", key: "risk", delta: 2 },
          { type: "relationship", target: "friend", key: "closeness", delta: -1 },
        ],
      },
      {
        id: "alone",
        label: "Eat somewhere quieter",
        result: "Lunch is peaceful. You notice details around the room you normally miss when people are talking to you.",
        effects: [
          { type: "personality", key: "social", delta: -2 },
          { type: "personality", key: "independence", delta: 3 },
        ],
      },
    ],
  },
  {
    id: "math_test",
    category: "School",
    age: [6, 12],
    title: "Mathematics test",
    body: "You get your mathematics test back today. Your score is {mathScore}%. {teacher.name} says you have been improving.",
    prompt: "What do you do with the good news?",
    choices: [
      {
        id: "tell_guardian",
        label: "Tell {guardian.name} when you get home",
        result: "You keep the paper neat in your bag. You already know the small expression {guardian.name} makes when they are proud of you.",
        effects: [
          { type: "relationship", target: "guardian", key: "closeness", delta: 3 },
          { type: "education", key: "mathematics", delta: 2 },
        ],
      },
      {
        id: "show_friend",
        label: "Show {friend.name}",
        result: "You show {friend.name} at lunch. Sharing good news turns out to make it feel slightly more real.",
        effects: [
          { type: "relationship", target: "friend", key: "closeness", delta: 3 },
          { type: "personality", key: "social", delta: 1 },
        ],
      },
      {
        id: "not_big_deal",
        label: "Pretend it isn't a big deal",
        result: "You shrug when anyone notices. Part of you is pleased anyway.",
        effects: [
          { type: "personality", key: "independence", delta: 2 },
          { type: "personality", key: "sensitivity", delta: 1 },
        ],
      },
      {
        id: "keep_it",
        label: "Keep it to yourself",
        result: "You tuck the paper into your bag. The result matters to you, even if nobody else sees it.",
        effects: [
          { type: "personality", key: "independence", delta: 3 },
          { type: "personality", key: "social", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "sunflowers_grandma",
    category: "Family",
    age: [7, 12],
    requirements: { hasGrandmother: true },
    title: "Grandma is planting sunflowers",
    body: "{grandmother.name} is kneeling in the yard with a packet of sunflower seeds. She notices you watching and asks if you want to help.",
    prompt: "What do you do?",
    choices: [
      {
        id: "help",
        label: "Help her plant them",
        result: "You get soil under your nails and accidentally plant two seeds much too close together. She leaves them that way.",
        effects: [
          { type: "relationship", target: "grandmother", key: "closeness", delta: 6 },
          { type: "interest", key: "gardening", delta: 8 },
        ],
        memory: { importance: 4, title: "Planted sunflowers with {grandmother.name}", copy: "You got soil on your hands and spent the afternoon planting sunflowers together." },
      },
      {
        id: "ask",
        label: "Ask why she likes sunflowers",
        result: "She tells you they remind her of a garden from when she was young. You had never thought much about adults having childhoods before.",
        effects: [
          { type: "relationship", target: "grandmother", key: "trust", delta: 5 },
          { type: "personality", key: "curiosity", delta: 4 },
        ],
        memory: { importance: 3, title: "A story about sunflowers", copy: "{grandmother.name} told you about a garden she remembered from her own childhood." },
      },
      {
        id: "inside",
        label: "Go back inside and play",
        result: "You decide dirt and gardening can survive without you. The afternoon becomes an ordinary one.",
        effects: [{ type: "interest", key: "gaming", delta: 3 }],
      },
      {
        id: "tired",
        label: "Tell her you're tired",
        result: "She nods and tells you to rest. Later you see the finished row of soil from the window.",
        effects: [
          { type: "health", key: "energy", delta: 3 },
          { type: "relationship", target: "grandmother", key: "trust", delta: 1 },
        ],
      },
    ],
  },
  {
    id: "rainy_afternoon",
    category: "Interests",
    age: [6, 12],
    title: "A long rainy afternoon",
    body: "Rain has been hitting the windows since lunch. Nobody expects you to go anywhere, and the afternoon is entirely yours.",
    prompt: "How do you spend it?",
    choices: [
      {
        id: "draw",
        label: "Draw for a while",
        result: "One page becomes several. By dinner, your hand is smudged with pencil and you have stopped noticing the rain.",
        effects: [
          { type: "interest", key: "drawing", delta: 7 },
          { type: "health", key: "stress", delta: -2 },
        ],
      },
      {
        id: "read",
        label: "Read something",
        result: "You start because there is nothing else to do and keep going because now you need to know what happens.",
        effects: [
          { type: "interest", key: "reading", delta: 7 },
          { type: "education", key: "language", delta: 2 },
          { type: "personality", key: "curiosity", delta: 2 },
        ],
      },
      {
        id: "game",
        label: "Play a game",
        result: "Hours disappear with suspicious efficiency. The rain stops before you notice it has changed.",
        effects: [
          { type: "interest", key: "gaming", delta: 6 },
          { type: "health", key: "energy", delta: -1 },
        ],
      },
      {
        id: "help_cook",
        label: "See what's happening in the kitchen",
        result: "You end up helping with dinner. Your contribution is small, but you become unexpectedly invested in how everything fits together.",
        effects: [
          { type: "interest", key: "cooking", delta: 7 },
          { type: "relationship", target: "guardian", key: "closeness", delta: 2 },
          { type: "interest", key: "making", delta: 2 },
        ],
      },
    ],
  },
  {
    id: "group_project",
    category: "School",
    age: [8, 12],
    title: "A group project",
    body: "{teacher.name} assigns a project that has to be finished by Friday. Your group spends the first ten minutes deciding absolutely nothing.",
    prompt: "What role do you take?",
    choices: [
      {
        id: "organize",
        label: "Start organizing everyone",
        result: "You make a list of what needs doing. Nobody applauds, but suddenly the project begins moving.",
        effects: [
          { type: "personality", key: "structure", delta: 5 },
          { type: "personality", key: "social", delta: 2 },
          { type: "education", key: "science", delta: 2 },
        ],
      },
      {
        id: "best_part",
        label: "Take the part you're best at",
        result: "You focus on your piece and do it carefully. The group benefits, although you do not become its unofficial manager.",
        effects: [
          { type: "personality", key: "independence", delta: 3 },
          { type: "education", key: "science", delta: 3 },
        ],
      },
      {
        id: "wait",
        label: "Wait for someone else to decide",
        result: "Eventually someone does. You follow the plan and feel relieved that the attention moved elsewhere.",
        effects: [
          { type: "personality", key: "social", delta: -2 },
          { type: "personality", key: "independence", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "friend_invitation",
    category: "Friends",
    age: [8, 12],
    title: "An invitation after school",
    body: "{friend.name} asks if you want to come over after school. You had expected to go straight home.",
    prompt: "What do you decide?",
    choices: [
      {
        id: "go",
        label: "Go with {friend.name}",
        result: "The afternoon feels different simply because it was not part of the plan. You see a version of {friend.name} that school does not show you.",
        effects: [
          { type: "relationship", target: "friend", key: "closeness", delta: 6 },
          { type: "relationship", target: "friend", key: "familiarity", delta: 4 },
          { type: "personality", key: "risk", delta: 2 },
        ],
        memory: { importance: 3, title: "An afternoon at {friend.name}'s home", copy: "You spent an ordinary after-school afternoon together that later became easy to remember." },
      },
      {
        id: "another_time",
        label: "Ask for another day",
        result: "{friend.name} seems a little disappointed, but not hurt. You make a vague plan for next week.",
        effects: [
          { type: "relationship", target: "friend", key: "trust", delta: 1 },
          { type: "personality", key: "structure", delta: 2 },
        ],
      },
      {
        id: "home",
        label: "Go home instead",
        result: "Home feels reassuring after a long day. You wonder briefly what you might have missed, then move on.",
        effects: [
          { type: "personality", key: "independence", delta: 1 },
          { type: "personality", key: "social", delta: -1 },
        ],
      },
    ],
  },
  {
    id: "small_allowance",
    category: "Money",
    age: [9, 12],
    title: "Money of your own",
    body: "You have saved a small amount of allowance. It is not much, but it is the first money that feels entirely yours.",
    prompt: "What do you do with it?",
    choices: [
      {
        id: "save",
        label: "Keep saving it",
        result: "Nothing exciting happens today. The amount simply becomes slightly larger, which is less dramatic and often more useful.",
        effects: [
          { type: "personality", key: "structure", delta: 4 },
          { type: "money", key: "savings", delta: 120 },
        ],
      },
      {
        id: "hobby",
        label: "Buy something for a hobby",
        result: "You spend most of it on something you have been wanting for weeks. You use it immediately when you get home.",
        effects: [
          { type: "interest", key: "making", delta: 4 },
          { type: "money", key: "savings", delta: -80 },
        ],
      },
      {
        id: "snacks",
        label: "Buy snacks for you and {friend.name}",
        result: "The money disappears quickly. The walk home together lasts longer than the snacks do.",
        effects: [
          { type: "relationship", target: "friend", key: "closeness", delta: 3 },
          { type: "money", key: "savings", delta: -60 },
        ],
      },
    ],
  },
  {
    id: "class_presentation",
    category: "School",
    age: [10, 12],
    title: "Speaking in front of the class",
    body: "Your name is called for a short presentation. The walk from your desk to the front of the room feels much longer than it objectively is.",
    prompt: "How do you handle it?",
    choices: [
      {
        id: "steady",
        label: "Take your time and speak clearly",
        result: "Your voice shakes at first, then settles. When you sit down again, the room looks exactly the same, which feels oddly important.",
        effects: [
          { type: "personality", key: "social", delta: 3 },
          { type: "personality", key: "sensitivity", delta: -2 },
          { type: "education", key: "language", delta: 3 },
        ],
        memory: { importance: 2, title: "A presentation you got through", copy: "You were nervous speaking in front of class and discovered that nervousness did not prevent you from doing it." },
      },
      {
        id: "fast",
        label: "Rush through it",
        result: "You finish quickly enough that you barely remember what you said. Relief arrives before pride does.",
        effects: [
          { type: "personality", key: "sensitivity", delta: 1 },
          { type: "education", key: "language", delta: 1 },
        ],
      },
      {
        id: "ask_partner",
        label: "Ask if your partner can start",
        result: "Someone else begins, which gives you time to breathe. When your turn comes, it feels a little less abrupt.",
        effects: [
          { type: "personality", key: "social", delta: 1 },
          { type: "personality", key: "structure", delta: 2 },
        ],
      },
    ],
  },
  {
    id: "sick_day",
    category: "Health",
    age: [2, 12],
    title: "A day home sick",
    body: "You wake with a sore throat and a heavy, tired feeling. The day you expected to have has quietly been cancelled.",
    prompt: "How do you spend the day?",
    choices: [
      {
        id: "rest",
        label: "Actually rest",
        result: "You sleep more than you expected. By evening, your body feels less like it is arguing with you.",
        effects: [
          { type: "health", key: "energy", delta: 5 },
          { type: "health", key: "stress", delta: -2 },
        ],
      },
      {
        id: "entertain",
        label: "Find something quiet to do",
        result: "You spend the day reading, drawing, and drifting in and out of sleep. It is not fun exactly, but it is gentle.",
        effects: [
          { type: "health", key: "energy", delta: 2 },
          { type: "interest", key: "reading", delta: 2 },
          { type: "interest", key: "drawing", delta: 2 },
        ],
      },
      {
        id: "push",
        label: "Act like you feel fine",
        result: "You manage for a few hours and then crash much harder in the afternoon. Bodies remain stubbornly unimpressed by optimism.",
        effects: [
          { type: "health", key: "energy", delta: -4 },
          { type: "personality", key: "risk", delta: 2 },
        ],
      },
    ],
  },
  {
    id: "family_evening",
    category: "Home",
    age: [0, 12],
    title: "An ordinary evening",
    body: "Nothing important is supposed to happen tonight. Dinner is simple, the house is familiar, and everyone is occupying the same few rooms in their usual ways.",
    prompt: "Where do you drift?",
    choices: [
      {
        id: "family",
        label: "Stay near everyone",
        result: "Nobody says anything profound. You simply remain together until the evening becomes bedtime.",
        effects: [
          { type: "relationship", target: "guardian", key: "closeness", delta: 2 },
          { type: "health", key: "stress", delta: -1 },
        ],
      },
      {
        id: "own_thing",
        label: "Do your own thing",
        result: "You settle into something that belongs only to you. The house remains around you without demanding much.",
        effects: [
          { type: "personality", key: "independence", delta: 2 },
          { type: "interest", key: "reading", delta: 1 },
          { type: "interest", key: "drawing", delta: 1 },
        ],
      },
      {
        id: "talk",
        label: "Tell someone about your day",
        result: "The story is not especially remarkable, but somebody listens anyway. That turns out to matter more than the story.",
        effects: [
          { type: "relationship", target: "guardian", key: "trust", delta: 3 },
          { type: "personality", key: "social", delta: 1 },
        ],
      },
    ],
  },
];
