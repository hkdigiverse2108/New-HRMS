import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Clock,
  Smile,
  Cat,
  Coffee,
  Trophy,
  Car,
  Lightbulb,
  Music,
  Flag,
  Search,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmojiItem {
  emoji: string;
  name: string;
  keywords?: string[];
}

export interface EmojiCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  emojis: EmojiItem[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: "smileys",
    name: "Smileys & People",
    icon: Smile,
    emojis: [
      { emoji: "😀", name: "grinning face", keywords: ["smile", "happy"] },
      { emoji: "😃", name: "grinning face with big eyes", keywords: ["smile", "happy", "joy"] },
      { emoji: "😄", name: "grinning face with smiling eyes", keywords: ["smile", "happy", "laugh"] },
      { emoji: "😁", name: "beaming face with smiling eyes", keywords: ["grin", "teeth"] },
      { emoji: "😆", name: "grinning squinting face", keywords: ["laugh", "haha"] },
      { emoji: "😅", name: "grinning face with sweat", keywords: ["whew", "nervous"] },
      { emoji: "🤣", name: "rolling on the floor laughing", keywords: ["rofl", "lol"] },
      { emoji: "😂", name: "face with tears of joy", keywords: ["crying", "laughing", "tears"] },
      { emoji: "🙂", name: "slightly smiling face", keywords: ["smile"] },
      { emoji: "🙃", name: "upside-down face", keywords: ["silly", "sarcasm"] },
      { emoji: "😉", name: "winking face", keywords: ["wink"] },
      { emoji: "😊", name: "smiling face with smiling eyes", keywords: ["blush", "proud"] },
      { emoji: "😇", name: "smiling face with halo", keywords: ["angel", "innocent"] },
      { emoji: "🥰", name: "smiling face with hearts", keywords: ["love", "crush"] },
      { emoji: "😍", name: "smiling face with heart-eyes", keywords: ["love", "heart"] },
      { emoji: "🤩", name: "star-struck", keywords: ["stars", "eyes", "wow"] },
      { emoji: "😘", name: "face blowing a kiss", keywords: ["kiss", "love"] },
      { emoji: "😗", name: "kissing face", keywords: ["kiss"] },
      { emoji: "😚", name: "kissing face with closed eyes", keywords: ["kiss"] },
      { emoji: "😙", name: "kissing face with smiling eyes", keywords: ["kiss"] },
      { emoji: "😋", name: "face savoring food", keywords: ["yummy", "delicious"] },
      { emoji: "😛", name: "face with tongue", keywords: ["tongue", "silly"] },
      { emoji: "😜", name: "winking face with tongue", keywords: ["crazy", "wink"] },
      { emoji: "🤪", name: "zany face", keywords: ["crazy", "goofy"] },
      { emoji: "😝", name: "squinting face with tongue", keywords: ["tongue", "prank"] },
      { emoji: "🤑", name: "money-mouth face", keywords: ["money", "rich", "dollar"] },
      { emoji: "🤗", name: "smiling face with open hands", keywords: ["hug"] },
      { emoji: "🤭", name: "face with hand over mouth", keywords: ["oops", "secret"] },
      { emoji: "🤫", name: "shushing face", keywords: ["quiet", "shh"] },
      { emoji: "🤔", name: "thinking face", keywords: ["think", "ponder"] },
      { emoji: "🤐", name: "zipper-mouth face", keywords: ["silence", "secret"] },
      { emoji: "🤨", name: "face with raised eyebrow", keywords: ["suspicious", "doubt"] },
      { emoji: "😐", name: "neutral face", keywords: ["meh"] },
      { emoji: "😑", name: "expressionless face", keywords: ["blank"] },
      { emoji: "😶", name: "face without mouth", keywords: ["mute"] },
      { emoji: "😏", name: "smirking face", keywords: ["smirk", "flirt"] },
      { emoji: "😒", name: "unamused face", keywords: ["bored", "unhappy"] },
      { emoji: "🙄", name: "face with rolling eyes", keywords: ["eye roll"] },
      { emoji: "😬", name: "grimacing face", keywords: ["awkward", "nervous"] },
      { emoji: "🤥", name: "lying face", keywords: ["pinocchio", "lie"] },
      { emoji: "😌", name: "relieved face", keywords: ["calm", "peace"] },
      { emoji: "😔", name: "pensive face", keywords: ["sad", "depressed"] },
      { emoji: "😪", name: "sleepy face", keywords: ["tired"] },
      { emoji: "🤤", name: "drooling face", keywords: ["drool"] },
      { emoji: "😴", name: "sleeping face", keywords: ["zzz", "sleep"] },
      { emoji: "😷", name: "face with medical mask", keywords: ["sick", "mask"] },
      { emoji: "🤒", name: "face with thermometer", keywords: ["fever", "ill"] },
      { emoji: "🤕", name: "face with head-bandage", keywords: ["hurt", "injured"] },
      { emoji: "🤢", name: "nauseated face", keywords: ["gross", "disgust"] },
      { emoji: "🤮", name: "face vomiting", keywords: ["barf", "puke"] },
      { emoji: "🤧", name: "sneezing face", keywords: ["achoo"] },
      { emoji: "🥵", name: "hot face", keywords: ["heat", "sweat"] },
      { emoji: "🥶", name: "cold face", keywords: ["freezing", "ice"] },
      { emoji: "🥴", name: "woozy face", keywords: ["dizzy", "tipsy"] },
      { emoji: "😵", name: "face with crossed-out eyes", keywords: ["dead", "shocked"] },
      { emoji: "🤯", name: "exploding head", keywords: ["mind blown", "shock"] },
      { emoji: "🤠", name: "cowboy hat face", keywords: ["cowboy"] },
      { emoji: "🥳", name: "partying face", keywords: ["celebrate", "birthday", "party"] },
      { emoji: "😎", name: "smiling face with sunglasses", keywords: ["cool", "glasses"] },
      { emoji: "🤓", name: "nerd face", keywords: ["nerd", "geek"] },
      { emoji: "🧐", name: "face with monocle", keywords: ["detective", "smart"] },
      { emoji: "😕", name: "confused face", keywords: ["confused"] },
      { emoji: "😟", name: "worried face", keywords: ["worry"] },
      { emoji: "🙁", name: "slightly frowning face", keywords: ["sad"] },
      { emoji: "😮", name: "face with open mouth", keywords: ["surprise", "wow"] },
      { emoji: "😯", name: "hushed face", keywords: ["surprise"] },
      { emoji: "😲", name: "astonished face", keywords: ["shock"] },
      { emoji: "😳", name: "flushed face", keywords: ["blush", "embarrassed"] },
      { emoji: "🥺", name: "pleading face", keywords: ["begging", "puppy eyes"] },
      { emoji: "😦", name: "frowning face with open mouth", keywords: ["sad"] },
      { emoji: "😧", name: "anguished face", keywords: ["pain"] },
      { emoji: "😨", name: "fearful face", keywords: ["scared", "fear"] },
      { emoji: "😰", name: "anxious face with sweat", keywords: ["nervous"] },
      { emoji: "😥", name: "sad but relieved face", keywords: ["phew"] },
      { emoji: "😢", name: "crying face", keywords: ["tear", "sad"] },
      { emoji: "😭", name: "loudly crying face", keywords: ["bawling", "sob"] },
      { emoji: "😱", name: "face screaming in fear", keywords: ["horror", "scream"] },
      { emoji: "😖", name: "confounded face", keywords: ["frustrated"] },
      { emoji: "😣", name: "persevering face", keywords: ["struggle"] },
      { emoji: "😞", name: "disappointed face", keywords: ["disappointed"] },
      { emoji: "😓", name: "downcast face with sweat", keywords: ["sweat"] },
      { emoji: "😩", name: "weary face", keywords: ["tired"] },
      { emoji: "😫", name: "tired face", keywords: ["exhausted"] },
      { emoji: "🥱", name: "yawning face", keywords: ["yawn", "sleepy"] },
      { emoji: "😤", name: "face with steam from nose", keywords: ["triumph", "angry"] },
      { emoji: "😡", name: "enraged face", keywords: ["angry", "mad", "red"] },
      { emoji: "😠", name: "angry face", keywords: ["mad"] },
      { emoji: "🤬", name: "face with symbols on mouth", keywords: ["swearing", "cuss"] },
      { emoji: "😈", name: "smiling face with horns", keywords: ["devil"] },
      { emoji: "👿", name: "angry face with horns", keywords: ["demon"] },
      { emoji: "💀", name: "skull", keywords: ["dead", "death"] },
      { emoji: "💩", name: "pile of poo", keywords: ["poop"] },
      { emoji: "🤡", name: "clown face", keywords: ["clown"] },
      { emoji: "👻", name: "ghost", keywords: ["boo", "halloween"] },
      { emoji: "👽", name: "alien", keywords: ["ufo", "space"] },
      { emoji: "🤖", name: "robot", keywords: ["bot", "ai"] },
      // Gestures & Hands
      { emoji: "👋", name: "waving hand", keywords: ["hello", "bye", "wave"] },
      { emoji: "🤚", name: "raised back of hand", keywords: ["hand"] },
      { emoji: "🖐️", name: "hand with fingers splayed", keywords: ["five"] },
      { emoji: "✋", name: "raised hand", keywords: ["high five", "stop"] },
      { emoji: "🖖", name: "vulcan salute", keywords: ["spock"] },
      { emoji: "👌", name: "OK hand", keywords: ["ok", "perfect"] },
      { emoji: "🤌", name: "pinched fingers", keywords: ["italian"] },
      { emoji: "✌️", name: "victory hand", keywords: ["peace", "v"] },
      { emoji: "🤞", name: "crossed fingers", keywords: ["luck", "hope"] },
      { emoji: "🤟", name: "love-you gesture", keywords: ["love"] },
      { emoji: "🤘", name: "sign of the horns", keywords: ["rock"] },
      { emoji: "🤙", name: "call me hand", keywords: ["call", "shaka"] },
      { emoji: "👈", name: "backhand index pointing left", keywords: ["point", "left"] },
      { emoji: "👉", name: "backhand index pointing right", keywords: ["point", "right"] },
      { emoji: "👆", name: "backhand index pointing up", keywords: ["point", "up"] },
      { emoji: "👇", name: "backhand index pointing down", keywords: ["point", "down"] },
      { emoji: "☝️", name: "index pointing up", keywords: ["one"] },
      { emoji: "👍", name: "thumbs up", keywords: ["yes", "like", "approve"] },
      { emoji: "👎", name: "thumbs down", keywords: ["no", "dislike"] },
      { emoji: "✊", name: "raised fist", keywords: ["power"] },
      { emoji: "👊", name: "oncoming fist", keywords: ["fist bump"] },
      { emoji: "🤛", name: "left-facing fist", keywords: ["fist"] },
      { emoji: "🤜", name: "right-facing fist", keywords: ["fist"] },
      { emoji: "👏", name: "clapping hands", keywords: ["applause", "bravo"] },
      { emoji: "🙌", name: "raising hands", keywords: ["celebrate", "hooray"] },
      { emoji: "👐", name: "open hands", keywords: ["open"] },
      { emoji: "🤲", name: "palms up together", keywords: ["prayer"] },
      { emoji: "🤝", name: "handshake", keywords: ["deal", "agreement"] },
      { emoji: "🙏", name: "folded hands", keywords: ["please", "thank you", "pray", "namaste"] }
    ]
  },
  {
    id: "animals",
    name: "Animals & Nature",
    icon: Cat,
    emojis: [
      { emoji: "🐶", name: "dog face", keywords: ["puppy", "pet"] },
      { emoji: "🐱", name: "cat face", keywords: ["kitten", "pet"] },
      { emoji: "🐭", name: "mouse face", keywords: ["mouse"] },
      { emoji: "🐹", name: "hamster face", keywords: ["hamster"] },
      { emoji: "🐰", name: "rabbit face", keywords: ["bunny"] },
      { emoji: "🦊", name: "fox face", keywords: ["fox"] },
      { emoji: "🐻", name: "bear face", keywords: ["bear"] },
      { emoji: "🐼", name: "panda face", keywords: ["panda"] },
      { emoji: "🐨", name: "koala", keywords: ["koala"] },
      { emoji: "🐯", name: "tiger face", keywords: ["tiger"] },
      { emoji: "🦁", name: "lion face", keywords: ["lion", "king"] },
      { emoji: "🐮", name: "cow face", keywords: ["cow"] },
      { emoji: "🐷", name: "pig face", keywords: ["pig"] },
      { emoji: "🐸", name: "frog face", keywords: ["frog"] },
      { emoji: "🐵", name: "monkey face", keywords: ["monkey"] },
      { emoji: "🐔", name: "chicken", keywords: ["chicken"] },
      { emoji: "🐧", name: "penguin", keywords: ["penguin"] },
      { emoji: "🐦", name: "bird", keywords: ["bird"] },
      { emoji: "🐤", name: "baby chick", keywords: ["chick"] },
      { emoji: "🦆", name: "duck", keywords: ["duck"] },
      { emoji: "🦅", name: "eagle", keywords: ["eagle"] },
      { emoji: "🦉", name: "owl", keywords: ["owl"] },
      { emoji: "🦇", name: "bat", keywords: ["bat"] },
      { emoji: "🐺", name: "wolf", keywords: ["wolf"] },
      { emoji: "🦄", name: "unicorn", keywords: ["magic", "unicorn"] },
      { emoji: "🐝", name: "honeybee", keywords: ["bee"] },
      { emoji: "🐛", name: "bug", keywords: ["caterpillar"] },
      { emoji: "🦋", name: "butterfly", keywords: ["butterfly"] },
      { emoji: "🐌", name: "snail", keywords: ["snail", "slow"] },
      { emoji: "🐞", name: "lady beetle", keywords: ["ladybug"] },
      { emoji: "🐢", name: "turtle", keywords: ["turtle"] },
      { emoji: "🐍", name: "snake", keywords: ["snake"] },
      { emoji: "🐙", name: "octopus", keywords: ["octopus"] },
      { emoji: "🐬", name: "dolphin", keywords: ["dolphin"] },
      { emoji: "🐳", name: "spouting whale", keywords: ["whale"] },
      { emoji: "🦈", name: "shark", keywords: ["shark"] },
      { emoji: "💐", name: "bouquet", keywords: ["flowers"] },
      { emoji: "🌸", name: "cherry blossom", keywords: ["flower", "spring"] },
      { emoji: "🌹", name: "rose", keywords: ["flower", "love"] },
      { emoji: "🌺", name: "hibiscus", keywords: ["flower"] },
      { emoji: "🌻", name: "sunflower", keywords: ["flower", "sun"] },
      { emoji: "🌼", name: "blossom", keywords: ["flower"] },
      { emoji: "🌷", name: "tulip", keywords: ["flower"] },
      { emoji: "🌱", name: "seedling", keywords: ["plant", "grow"] },
      { emoji: "🌲", name: "evergreen tree", keywords: ["tree"] },
      { emoji: "🌳", name: "deciduous tree", keywords: ["tree"] },
      { emoji: "🌴", name: "palm tree", keywords: ["beach", "tropical"] },
      { emoji: "🍀", name: "four leaf clover", keywords: ["lucky"] },
      { emoji: "🍁", name: "maple leaf", keywords: ["autumn", "canada"] },
      { emoji: "🍂", name: "fallen leaf", keywords: ["leaves"] },
      { emoji: "🍃", name: "leaf fluttering in wind", keywords: ["wind"] }
    ]
  },
  {
    id: "food",
    name: "Food & Drink",
    icon: Coffee,
    emojis: [
      { emoji: "🍏", name: "green apple", keywords: ["fruit", "apple"] },
      { emoji: "🍎", name: "red apple", keywords: ["fruit", "apple"] },
      { emoji: "🍐", name: "pear", keywords: ["fruit"] },
      { emoji: "🍊", name: "tangerine", keywords: ["orange", "fruit"] },
      { emoji: "🍋", name: "lemon", keywords: ["citrus"] },
      { emoji: "🍌", name: "banana", keywords: ["fruit"] },
      { emoji: "🍉", name: "watermelon", keywords: ["fruit", "summer"] },
      { emoji: "🍇", name: "grapes", keywords: ["fruit"] },
      { emoji: "🍓", name: "strawberry", keywords: ["berry", "fruit"] },
      { emoji: "🍒", name: "cherries", keywords: ["fruit"] },
      { emoji: "🍑", name: "peach", keywords: ["fruit"] },
      { emoji: "🥭", name: "mango", keywords: ["fruit"] },
      { emoji: "🍍", name: "pineapple", keywords: ["fruit"] },
      { emoji: "🥥", name: "coconut", keywords: ["fruit"] },
      { emoji: "🥑", name: "avocado", keywords: ["food"] },
      { emoji: "🍆", name: "eggplant", keywords: ["vegetable"] },
      { emoji: "🥔", name: "potato", keywords: ["vegetable"] },
      { emoji: "🥕", name: "carrot", keywords: ["vegetable"] },
      { emoji: "🌽", name: "ear of corn", keywords: ["corn"] },
      { emoji: "🌶️", name: "hot pepper", keywords: ["spicy", "chili"] },
      { emoji: "🥒", name: "cucumber", keywords: ["pickle"] },
      { emoji: "🍞", name: "bread", keywords: ["toast", "bakery"] },
      { emoji: "🥐", name: "croissant", keywords: ["french", "pastry"] },
      { emoji: "🥖", name: "baguette bread", keywords: ["french"] },
      { emoji: "🥨", name: "pretzel", keywords: ["snack"] },
      { emoji: "🧀", name: "cheese wedge", keywords: ["cheese"] },
      { emoji: "🥞", name: "pancakes", keywords: ["breakfast"] },
      { emoji: "🧇", name: "waffle", keywords: ["breakfast"] },
      { emoji: "🍔", name: "hamburger", keywords: ["burger", "fast food"] },
      { emoji: "🍟", name: "french fries", keywords: ["chips"] },
      { emoji: "🍕", name: "pizza", keywords: ["italian", "slice"] },
      { emoji: "🌭", name: "hot dog", keywords: ["sausage"] },
      { emoji: "🥪", name: "sandwich", keywords: ["lunch"] },
      { emoji: "🌮", name: "taco", keywords: ["mexican"] },
      { emoji: "🌯", name: "burrito", keywords: ["wrap"] },
      { emoji: "🍜", name: "steaming bowl", keywords: ["ramen", "noodles"] },
      { emoji: "🍝", name: "spaghetti", keywords: ["pasta"] },
      { emoji: "🍣", name: "sushi", keywords: ["japanese"] },
      { emoji: "🍦", name: "soft ice cream", keywords: ["dessert"] },
      { emoji: "🍩", name: "doughnut", keywords: ["donut", "sweet"] },
      { emoji: "🍪", name: "cookie", keywords: ["biscuit", "chocolate"] },
      { emoji: "🎂", name: "birthday cake", keywords: ["celebrate", "party"] },
      { emoji: "🍰", name: "shortcake", keywords: ["cake", "dessert"] },
      { emoji: "🧁", name: "cupcake", keywords: ["sweet"] },
      { emoji: "🍫", name: "chocolate bar", keywords: ["candy", "sweet"] },
      { emoji: "🍬", name: "candy", keywords: ["sweet"] },
      { emoji: "🍭", name: "lollipop", keywords: ["candy"] },
      { emoji: "☕", name: "hot beverage", keywords: ["coffee", "tea", "cappuccino"] },
      { emoji: "🍵", name: "teacup without handle", keywords: ["green tea", "matcha"] },
      { emoji: "🧃", name: "beverage box", keywords: ["juice"] },
      { emoji: "🥤", name: "cup with straw", keywords: ["soda", "drink"] },
      { emoji: "🧋", name: "bubble tea", keywords: ["boba"] },
      { emoji: "🍺", name: "beer mug", keywords: ["alcohol", "drink"] },
      { emoji: "🍻", name: "clinking beer mugs", keywords: ["cheers", "party"] },
      { emoji: "🥂", name: "clinking glasses", keywords: ["celebrate", "toast"] },
      { emoji: "🍷", name: "wine glass", keywords: ["wine", "drink"] }
    ]
  },
  {
    id: "activities",
    name: "Activity",
    icon: Trophy,
    emojis: [
      { emoji: "⚽", name: "soccer ball", keywords: ["football", "sports"] },
      { emoji: "🏀", name: "basketball", keywords: ["sports"] },
      { emoji: "🏈", name: "american football", keywords: ["sports"] },
      { emoji: "⚾", name: "baseball", keywords: ["sports"] },
      { emoji: "🥎", name: "softball", keywords: ["sports"] },
      { emoji: "🎾", name: "tennis", keywords: ["sports"] },
      { emoji: "🏐", name: "volleyball", keywords: ["sports"] },
      { emoji: "🏉", name: "rugby football", keywords: ["sports"] },
      { emoji: "🥏", name: "flying disc", keywords: ["frisbee"] },
      { emoji: "🎱", name: "pool 8 ball", keywords: ["billiards"] },
      { emoji: "🏓", name: "ping pong", keywords: ["table tennis"] },
      { emoji: "🏸", name: "badminton", keywords: ["sports"] },
      { emoji: "🥊", name: "boxing glove", keywords: ["fight"] },
      { emoji: "🥋", name: "martial arts uniform", keywords: ["karate", "judo"] },
      { emoji: "🎯", name: "bullseye", keywords: ["target", "darts"] },
      { emoji: "⛳", name: "flag in hole", keywords: ["golf"] },
      { emoji: "⛸️", name: "ice skate", keywords: ["skating"] },
      { emoji: "🎣", name: "fishing pole", keywords: ["fish"] },
      { emoji: "🤿", name: "diving mask", keywords: ["scuba", "snorkel"] },
      { emoji: "🎽", name: "running shirt", keywords: ["marathon"] },
      { emoji: "🎿", name: "skis", keywords: ["snow", "winter"] },
      { emoji: "🛷", name: "sled", keywords: ["sleigh"] },
      { emoji: "🥌", name: "curling stone", keywords: ["curling"] },
      { emoji: "🎮", name: "video game", keywords: ["gaming", "playstation", "xbox"] },
      { emoji: "🎲", name: "game die", keywords: ["dice", "board game"] },
      { emoji: "🧩", name: "puzzle piece", keywords: ["jigsaw"] },
      { emoji: "♟️", name: "chess pawn", keywords: ["chess", "strategy"] },
      { emoji: "🎭", name: "performing arts", keywords: ["theater", "drama"] },
      { emoji: "🎨", name: "artist palette", keywords: ["art", "paint"] },
      { emoji: "🧵", name: "thread", keywords: ["sewing"] },
      { emoji: "🧶", name: "yarn", keywords: ["knitting"] },
      { emoji: "🏆", name: "trophy", keywords: ["winner", "first", "champion"] },
      { emoji: "🥇", name: "1st place medal", keywords: ["gold", "winner"] },
      { emoji: "🥈", name: "2nd place medal", keywords: ["silver"] },
      { emoji: "🥉", name: "3rd place medal", keywords: ["bronze"] },
      { emoji: "🎖️", name: "military medal", keywords: ["honor"] },
      { emoji: "🎪", name: "circus tent", keywords: ["carnival"] },
      { emoji: "🎟️", name: "admission tickets", keywords: ["cinema", "movie"] },
      { emoji: "🎫", name: "ticket", keywords: ["pass"] },
      { emoji: "🎬", name: "clapper board", keywords: ["movie", "film", "action"] },
      { emoji: "🎤", name: "microphone", keywords: ["sing", "karaoke"] },
      { emoji: "🎧", name: "headphone", keywords: ["music", "listen"] },
      { emoji: "🎼", name: "musical score", keywords: ["notes"] },
      { emoji: "🎹", name: "musical keyboard", keywords: ["piano"] },
      { emoji: "🥁", name: "drum", keywords: ["music"] },
      { emoji: "🎷", name: "saxophone", keywords: ["jazz"] },
      { emoji: "🎺", name: "trumpet", keywords: ["brass"] },
      { emoji: "🎸", name: "guitar", keywords: ["rock", "music"] },
      { emoji: "🪕", name: "banjo", keywords: ["folk"] },
      { emoji: "🎻", name: "violin", keywords: ["classical"] }
    ]
  },
  {
    id: "travel",
    name: "Travel & Places",
    icon: Car,
    emojis: [
      { emoji: "🚗", name: "automobile", keywords: ["car"] },
      { emoji: "🚕", name: "taxi", keywords: ["cab"] },
      { emoji: "🚙", name: "sport utility vehicle", keywords: ["suv"] },
      { emoji: "🚌", name: "bus", keywords: ["transport"] },
      { emoji: "🚎", name: "trolleybus", keywords: ["bus"] },
      { emoji: "🏎️", name: "racing car", keywords: ["f1", "race"] },
      { emoji: "🚓", name: "police car", keywords: ["cop"] },
      { emoji: "🚑", name: "ambulance", keywords: ["hospital", "emergency"] },
      { emoji: "🚒", name: "fire engine", keywords: ["fire"] },
      { emoji: "🚐", name: "minibus", keywords: ["van"] },
      { emoji: "🛻", name: "pickup truck", keywords: ["truck"] },
      { emoji: "🚚", name: "delivery truck", keywords: ["shipping"] },
      { emoji: "🚛", name: "articulated lorry", keywords: ["semi"] },
      { emoji: "🚜", name: "tractor", keywords: ["farm"] },
      { emoji: "🛵", name: "motor scooter", keywords: ["scooter", "vespa"] },
      { emoji: "🏍️", name: "motorcycle", keywords: ["bike"] },
      { emoji: "🛺", name: "auto rickshaw", keywords: ["tuk tuk"] },
      { emoji: "🚲", name: "bicycle", keywords: ["bike", "cycling"] },
      { emoji: "🛴", name: "kick scooter", keywords: ["scooter"] },
      { emoji: "🚨", name: "police car light", keywords: ["alert", "siren"] },
      { emoji: "⛽", name: "fuel pump", keywords: ["gas", "petrol"] },
      { emoji: "🚂", name: "locomotive", keywords: ["train", "steam"] },
      { emoji: "🚆", name: "train", keywords: ["rail"] },
      { emoji: "🚇", name: "metro", keywords: ["subway"] },
      { emoji: "✈️", name: "airplane", keywords: ["flight", "travel"] },
      { emoji: "🛫", name: "airplane departure", keywords: ["takeoff"] },
      { emoji: "🛬", name: "airplane arrival", keywords: ["landing"] },
      { emoji: "🚀", name: "rocket", keywords: ["space", "moon", "launch"] },
      { emoji: "🚁", name: "helicopter", keywords: ["chopper"] },
      { emoji: "⛵", name: "sailboat", keywords: ["boat"] },
      { emoji: "🚤", name: "speedboat", keywords: ["boat"] },
      { emoji: "🚢", name: "ship", keywords: ["cruise"] },
      { emoji: "🏖️", name: "beach with umbrella", keywords: ["vacation", "sea"] },
      { emoji: "🏝️", name: "desert island", keywords: ["island"] },
      { emoji: "🏕️", name: "camping", keywords: ["tent", "nature"] },
      { emoji: "⛰️", name: "mountain", keywords: ["hiking"] },
      { emoji: "🏔️", name: "snow-capped mountain", keywords: ["snow"] },
      { emoji: "🌋", name: "volcano", keywords: ["lava"] },
      { emoji: "🏜️", name: "desert", keywords: ["sand"] },
      { emoji: "🏠", name: "house", keywords: ["home"] },
      { emoji: "🏡", name: "house with garden", keywords: ["home"] },
      { emoji: "🏢", name: "office building", keywords: ["work", "company"] },
      { emoji: "🏣", name: "japanese post office", keywords: ["mail"] },
      { emoji: "🏥", name: "hospital", keywords: ["doctor", "health"] },
      { emoji: "🏦", name: "bank", keywords: ["money"] },
      { emoji: "🏨", name: "hotel", keywords: ["room", "vacation"] },
      { emoji: "🏩", name: "love hotel", keywords: ["heart"] },
      { emoji: "🏪", name: "convenience store", keywords: ["shop"] },
      { emoji: "🏫", name: "school", keywords: ["education"] },
      { emoji: "🏬", name: "department store", keywords: ["mall"] },
      { emoji: "🏭", name: "factory", keywords: ["industry"] },
      { emoji: "🏰", name: "castle", keywords: ["palace"] },
      { emoji: "🗼", name: "Tokyo tower", keywords: ["landmark"] },
      { emoji: "🗽", name: "Statue of Liberty", keywords: ["usa", "new york"] }
    ]
  },
  {
    id: "objects",
    name: "Objects",
    icon: Lightbulb,
    emojis: [
      { emoji: "💡", name: "light bulb", keywords: ["idea", "bright"] },
      { emoji: "🔦", name: "flashlight", keywords: ["torch"] },
      { emoji: "🕯️", name: "candle", keywords: ["flame"] },
      { emoji: "📱", name: "mobile phone", keywords: ["iphone", "android"] },
      { emoji: "📲", name: "mobile phone with arrow", keywords: ["call"] },
      { emoji: "💻", name: "laptop", keywords: ["computer", "pc", "mac"] },
      { emoji: "⌨️", name: "keyboard", keywords: ["type"] },
      { emoji: "🖥️", name: "desktop computer", keywords: ["screen"] },
      { emoji: "🖨️", name: "printer", keywords: ["print"] },
      { emoji: "🖱️", name: "computer mouse", keywords: ["click"] },
      { emoji: "📷", name: "camera", keywords: ["photo", "picture"] },
      { emoji: "📸", name: "camera with flash", keywords: ["flash"] },
      { emoji: "📹", name: "video camera", keywords: ["recording"] },
      { emoji: "📼", name: "videocassette", keywords: ["vhs"] },
      { emoji: "🔍", name: "magnifying glass tilted left", keywords: ["search", "find"] },
      { emoji: "🔎", name: "magnifying glass tilted right", keywords: ["search"] },
      { emoji: "🔬", name: "microscope", keywords: ["science"] },
      { emoji: "🔭", name: "telescope", keywords: ["stars"] },
      { emoji: "📡", name: "satellite antenna", keywords: ["signal"] },
      { emoji: "📺", name: "television", keywords: ["tv"] },
      { emoji: "📻", name: "radio", keywords: ["broadcast"] },
      { emoji: "⏰", name: "alarm clock", keywords: ["time", "wake"] },
      { emoji: "⏱️", name: "stopwatch", keywords: ["timer"] },
      { emoji: "⏳", name: "hourglass not done", keywords: ["time"] },
      { emoji: "⌛", name: "hourglass done", keywords: ["sand"] },
      { emoji: "🔋", name: "battery", keywords: ["power", "energy"] },
      { emoji: "🔌", name: "electric plug", keywords: ["charge"] },
      { emoji: "🧲", name: "magnet", keywords: ["attract"] },
      { emoji: "💎", name: "gem stone", keywords: ["diamond", "jewel"] },
      { emoji: "🔑", name: "key", keywords: ["lock", "password"] },
      { emoji: "🔒", name: "locked", keywords: ["secure", "padlock"] },
      { emoji: "🔓", name: "unlocked", keywords: ["open"] },
      { emoji: "🔔", name: "bell", keywords: ["notification", "alert"] },
      { emoji: "📦", name: "package", keywords: ["box", "delivery"] },
      { emoji: "📧", name: "e-mail", keywords: ["letter", "inbox"] },
      { emoji: "✉️", name: "envelope", keywords: ["mail"] },
      { emoji: "📝", name: "memo", keywords: ["note", "pencil", "write"] },
      { emoji: "📁", name: "file folder", keywords: ["directory"] },
      { emoji: "📂", name: "open file folder", keywords: ["files"] },
      { emoji: "📄", name: "page facing up", keywords: ["document", "paper"] },
      { emoji: "📅", name: "calendar", keywords: ["date", "schedule"] },
      { emoji: "📊", name: "bar chart", keywords: ["stats", "analytics"] },
      { emoji: "📈", name: "chart increasing", keywords: ["upward", "growth"] },
      { emoji: "📉", name: "chart decreasing", keywords: ["downward"] },
      { emoji: "📌", name: "pushpin", keywords: ["pin"] },
      { emoji: "📎", name: "paperclip", keywords: ["attachment"] },
      { emoji: "✂️", name: "scissors", keywords: ["cut"] },
      { emoji: "🗑️", name: "wastebasket", keywords: ["trash", "delete"] },
      { emoji: "🎁", name: "wrapped gift", keywords: ["present", "birthday"] },
      { emoji: "🎈", name: "balloon", keywords: ["party"] },
      { emoji: "🎉", name: "party popper", keywords: ["tada", "celebrate", "congrats"] },
      { emoji: "🎊", name: "confetti ball", keywords: ["festival"] }
    ]
  },
  {
    id: "symbols",
    name: "Symbols",
    icon: Music,
    emojis: [
      { emoji: "❤️", name: "red heart", keywords: ["love", "heart"] },
      { emoji: "🧡", name: "orange heart", keywords: ["love"] },
      { emoji: "💛", name: "yellow heart", keywords: ["love"] },
      { emoji: "💚", name: "green heart", keywords: ["love"] },
      { emoji: "💙", name: "blue heart", keywords: ["love"] },
      { emoji: "💜", name: "purple heart", keywords: ["love"] },
      { emoji: "🖤", name: "black heart", keywords: ["love"] },
      { emoji: "🤍", name: "white heart", keywords: ["love"] },
      { emoji: "🤎", name: "brown heart", keywords: ["love"] },
      { emoji: "💔", name: "broken heart", keywords: ["breakup", "sad"] },
      { emoji: "❣️", name: "heart exclamation", keywords: ["love"] },
      { emoji: "💕", name: "two hearts", keywords: ["love"] },
      { emoji: "💞", name: "revolving hearts", keywords: ["love"] },
      { emoji: "💓", name: "beating heart", keywords: ["love"] },
      { emoji: "💗", name: "growing heart", keywords: ["love"] },
      { emoji: "💖", name: "sparkling heart", keywords: ["love", "shine"] },
      { emoji: "💘", name: "heart with arrow", keywords: ["cupid"] },
      { emoji: "💝", name: "heart with ribbon", keywords: ["gift"] },
      { emoji: "💟", name: "heart decoration", keywords: ["love"] },
      { emoji: "✨", name: "sparkles", keywords: ["magic", "stars", "clean", "ai"] },
      { emoji: "⭐", name: "star", keywords: ["favorite"] },
      { emoji: "🌟", name: "glowing star", keywords: ["bright"] },
      { emoji: "💫", name: "dizzy", keywords: ["star"] },
      { emoji: "⚡", name: "high voltage", keywords: ["lightning", "fast", "electric"] },
      { emoji: "🔥", name: "fire", keywords: ["lit", "hot", "trending"] },
      { emoji: "💥", name: "collision", keywords: ["boom", "crash"] },
      { emoji: "💯", name: "hundred points", keywords: ["100", "perfect"] },
      { emoji: "💢", name: "anger symbol", keywords: ["angry"] },
      { emoji: "💨", name: "dashing away", keywords: ["fast", "run"] },
      { emoji: "💦", name: "sweat droplets", keywords: ["water", "work"] },
      { emoji: "💤", name: "zzz", keywords: ["sleep", "tired"] },
      { emoji: "✅", name: "check mark button", keywords: ["tick", "correct", "done", "yes"] },
      { emoji: "✔️", name: "check mark", keywords: ["tick"] },
      { emoji: "❌", name: "cross mark", keywords: ["x", "no", "wrong"] },
      { emoji: "❎", name: "cross mark button", keywords: ["no"] },
      { emoji: "➕", name: "plus sign", keywords: ["add"] },
      { emoji: "➖", name: "minus sign", keywords: ["subtract"] },
      { emoji: "➗", name: "division sign", keywords: ["divide"] },
      { emoji: "✖️", name: "multiplication sign", keywords: ["multiply"] },
      { emoji: "❓", name: "question mark", keywords: ["what", "help"] },
      { emoji: "❗", name: "exclamation mark", keywords: ["warning", "alert"] },
      { emoji: "⚠️", name: "warning", keywords: ["danger", "caution"] },
      { emoji: "⛔", name: "no entry", keywords: ["stop"] },
      { emoji: "🚫", name: "prohibited", keywords: ["forbidden"] },
      { emoji: "ℹ️", name: "information", keywords: ["info"] },
      { emoji: "🆕", name: "NEW button", keywords: ["new"] },
      { emoji: "🆙", name: "UP! button", keywords: ["up"] },
      { emoji: "🆗", name: "OK button", keywords: ["ok"] },
      { emoji: "🔄", name: "counterclockwise arrows button", keywords: ["sync", "reload"] },
      { emoji: "🔝", name: "TOP arrow", keywords: ["top"] },
      { emoji: "🔙", name: "BACK arrow", keywords: ["back"] }
    ]
  },
  {
    id: "flags",
    name: "Flags",
    icon: Flag,
    emojis: [
      { emoji: "🇮🇳", name: "flag India", keywords: ["india", "bharat", "indian"] },
      { emoji: "🇺🇸", name: "flag United States", keywords: ["usa", "america"] },
      { emoji: "🇬🇧", name: "flag United Kingdom", keywords: ["uk", "britain"] },
      { emoji: "🇨🇦", name: "flag Canada", keywords: ["canada"] },
      { emoji: "🇦🇺", name: "flag Australia", keywords: ["australia"] },
      { emoji: "🇩🇪", name: "flag Germany", keywords: ["germany"] },
      { emoji: "🇫🇷", name: "flag France", keywords: ["france"] },
      { emoji: "🇯🇵", name: "flag Japan", keywords: ["japan"] },
      { emoji: "🇨🇳", name: "flag China", keywords: ["china"] },
      { emoji: "🇧🇷", name: "flag Brazil", keywords: ["brazil"] },
      { emoji: "🇷🇺", name: "flag Russia", keywords: ["russia"] },
      { emoji: "🇦🇪", name: "flag United Arab Emirates", keywords: ["uae", "dubai"] },
      { emoji: "🏁", name: "chequered flag", keywords: ["race", "finish"] },
      { emoji: "🚩", name: "triangular flag", keywords: ["red flag"] },
      { emoji: "🎌", name: "crossed flags", keywords: ["japan"] },
      { emoji: "🏴‍☠️", name: "pirate flag", keywords: ["jolly roger"] }
    ]
  }
];

const STORAGE_RECENT_KEY = "chat_recent_emojis";

export interface WhatsAppEmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
  autoFocusSearch?: boolean;
}

export const WhatsAppEmojiPicker: React.FC<WhatsAppEmojiPickerProps> = ({
  onSelect,
  onClose,
  className,
  autoFocusSearch = false
}) => {
  const [activeCategory, setActiveCategory] = useState<string>("recent");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_RECENT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    // Default recents matching Screenshot 1
    return ["🤣", "😂", "😭", "👍", "❤️", "🙏", "😍", "🔥"];
  });

  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleEmojiClick = (emoji: string) => {
    // Update recents
    setRecentEmojis((prev) => {
      const filtered = prev.filter((e) => e !== emoji);
      const updated = [emoji, ...filtered].slice(0, 24);
      try {
        localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    onSelect(emoji);
  };

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    setSearchQuery("");
    const target = categoryRefs.current[catId];
    if (target && scrollContainerRef.current) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Filtered search results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    const matched: EmojiItem[] = [];
    const seen = new Set<string>();

    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.emojis) {
        if (seen.has(item.emoji)) continue;
        const nameMatch = item.name.toLowerCase().includes(q);
        const keywordMatch = item.keywords?.some((k) => k.toLowerCase().includes(q));
        if (nameMatch || keywordMatch) {
          seen.add(item.emoji);
          matched.push(item);
        }
      }
    }
    return matched;
  }, [searchQuery]);

  return (
    <div
      className={cn(
        "flex flex-col bg-card border border-border shadow-2xl rounded-2xl overflow-hidden w-full max-w-[360px] sm:max-w-[400px] h-[400px] sm:h-[440px] text-foreground select-none z-50 animate-in fade-in zoom-in-95 duration-150",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Category Tabs Header (WhatsApp Web style) */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-2 py-1.5 shrink-0 overflow-x-auto no-scrollbar gap-1">
        <button
          type="button"
          onClick={() => scrollToCategory("recent")}
          title="Recent"
          className={cn(
            "p-2 rounded-lg text-muted-foreground hover:text-foreground transition-all relative shrink-0 cursor-pointer",
            activeCategory === "recent" && "text-emerald-600 dark:text-emerald-400 font-bold"
          )}
        >
          <Clock className="w-4 h-4" />
          {activeCategory === "recent" && (
            <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-emerald-600 rounded-full" />
          )}
        </button>

        {EMOJI_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => scrollToCategory(cat.id)}
              title={cat.name}
              className={cn(
                "p-2 rounded-lg text-muted-foreground hover:text-foreground transition-all relative shrink-0 cursor-pointer",
                isActive && "text-emerald-600 dark:text-emerald-400 font-bold"
              )}
            >
              <Icon className="w-4 h-4" />
              {isActive && (
                <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-emerald-600 rounded-full" />
              )}
            </button>
          );
        })}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-colors cursor-pointer shrink-0 ml-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 2. Search Input (Screenshot 1: rounded pill search with green border focus) */}
      <div className="p-2.5 border-b border-border shrink-0 bg-background/50">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            autoFocus={autoFocusSearch}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search emoji"
            className="w-full pl-9 pr-8 py-2 bg-muted/40 hover:bg-muted/60 focus:bg-background border border-border focus:border-emerald-500 rounded-full text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 p-1 text-muted-foreground hover:text-foreground rounded-full cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Emojis Scrollable Body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-4 text-xs font-semibold no-scrollbar"
      >
        {/* Search Results Mode */}
        {searchResults !== null ? (
          <div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
              Search Results ({searchResults.length})
            </div>
            {searchResults.length > 0 ? (
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                {searchResults.map((item, idx) => (
                  <button
                    key={`${item.emoji}-${idx}`}
                    type="button"
                    title={item.name}
                    onClick={() => handleEmojiClick(item.emoji)}
                    className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-2xl hover:bg-muted rounded-xl transition-transform active:scale-125 hover:scale-110 cursor-pointer"
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-xs">
                No emojis found for "{searchQuery}"
              </div>
            )}
          </div>
        ) : (
          /* Normal Categorized Mode */
          <>
            {/* Recent Section */}
            {recentEmojis.length > 0 && (
              <div
                ref={(el) => {
                  categoryRefs.current["recent"] = el;
                }}
              >
                <div className="text-[11px] font-bold text-muted-foreground mb-2 px-1">
                  Recent
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                  {recentEmojis.map((emoji, idx) => (
                    <button
                      key={`recent-${emoji}-${idx}`}
                      type="button"
                      onClick={() => handleEmojiClick(emoji)}
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-2xl hover:bg-muted rounded-xl transition-transform active:scale-125 hover:scale-110 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All Categories */}
            {EMOJI_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                ref={(el) => {
                  categoryRefs.current[cat.id] = el;
                }}
              >
                <div className="text-[11px] font-bold text-muted-foreground mb-2 px-1">
                  {cat.name}
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5">
                  {cat.emojis.map((item, idx) => (
                    <button
                      key={`${cat.id}-${item.emoji}-${idx}`}
                      type="button"
                      title={item.name}
                      onClick={() => handleEmojiClick(item.emoji)}
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-2xl hover:bg-muted rounded-xl transition-transform active:scale-125 hover:scale-110 cursor-pointer"
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default WhatsAppEmojiPicker;
