# Introduction
![image](https://user-images.githubusercontent.com/12089891/174282003-6d93903f-6c52-428b-bc15-71f335ef18cc.png)

Autodartsbot is an automatic darts opponent for https://autodarts.io. It uses the autodarts API's to communicate with the server and get the current match info. There are currently 7 levels to play against:

- Level 1: averages 95 PPR
- Level 2: averages 78 PPR
- Level 3: averages 68 PPR
- Level 4: averages 56 PPR
- Level 5: averages 49 PPR
- Level 6: averages 36 PPR
- Level 7: averages 30 PPR

These averages are the result of 5000 simulated matches for each level. The bot, like you and I, can also have good and bad legs. So it's possible that a level 5 bot averages 70 PPR in one leg and 40 PPR in the next.

# Installation & use
See the [releases page](https://github.com/RingoM/autodartsbot/releases) for install instructions. After installation, on linux the bot can be started with the `autodartsbot` command, on windows you just doubleclick the exe file. When the bot is started for the first time, it'll ask you for your autodarts credentials. These are necessary to be able to communicate with the autodarts server. After you're logged in, autodartsbot will listen to the autodarts server for new games. When you start a new game, it'll look if you want to play against a bot and automatically take it's turn when necessary.

![image](https://user-images.githubusercontent.com/12089891/174286217-e04752a6-62f1-4d2b-bef5-ffb2896f0a05.png)

<br>

### Alright, I've got autodartsbot running. How do I actually play against a bot opponent?

Well, actually it's quite simple. Just start a new game, add a player with the name `autodartsbot[1-7]` and start the game. The number determines the level of the bot, eg. `autodartsbot5` will be a level 5 bot. When no number is present or an invalid number, you'll play against a random bot.

![image](https://user-images.githubusercontent.com/12089891/174287810-f2b82d0f-c88c-4337-80fb-184b26ab01f2.png)

## Current limitations
- Only for X01 games (currently).
- Bot doesn't know master in/out. Bot will default to double in/out.
- Only 1 game at a time. Bot will listen to the last game started with a bot present.
- Only 1 bot per game. If you add multiple, only the first will be a bot.
- Bot throws can't be undone, otherwise he'll freak out. So if you need to adjust your throw, do it before taking out your darts.
- Bot logic is local. When communication with the server is disrupted, the local scores and the server scores won't match and bot shuts down.
- Probably a lot more. Feel free to let me know when you encounter bugs.
