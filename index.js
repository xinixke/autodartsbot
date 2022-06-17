const Keycloak = require('keycloak-connect');
const axios = require('axios').default;
const WebSocket = require('ws').WebSocket;
const { X01Bot, UserPlayer, X01Game } = require('./src/dartbot');
const storage = require('node-persist');
const os = require('os');
const path = require('path');
const fs = require('fs');
const ConfigParser = require('configparser');
const prompts = require('prompts');
const color = require('kleur');
const cfonts = require('cfonts');

const AUTODART_URL = 'https://autodarts.io';
const AUTODART_AUTH_URL = 'https://login.autodarts.io/auth/';
const AUTODART_AUTH_TICKET_URL = 'https://api.autodarts.io/ms/v0/ticket';
const AUTODART_CLIENT_ID = 'autodarts-app';
const AUTODART_REALM_NAME = 'autodarts';
const AUTODART_MATCHES_URL = 'https://api.autodarts.io/gs/v0/matches/';
const AUTODART_BOARDS_URL = 'https://api.autodarts.io/bs/v0/boards/';
const AUTODART_WEBSOCKET_URL = 'wss://api.autodarts.io/ms/v0/subscribe?ticket=';

const homedir = os.homedir();
const autodartsbotConfig = path.join(homedir, '.autodarts', 'autodartsbot','config.cfg');
const autodartsConfig = path.join(homedir, '.autodarts', 'config.cfg');

cfonts.say('autodartsbot', {
	font: 'shade',              // define the font face
	align: 'left',              // define text alignment
	colors: ['white'],         // define all colors
	background: 'transparent',  // define the background color, you can also use `backgroundColor` here as key
	letterSpacing: 1,           // define letter spacing
	lineHeight: 1,              // define the line height
	space: false,                // define if the output text should have empty lines on top and on the bottom
	maxLength: '0',             // define how many character can be on one line
	gradient: false,            // define your two gradient colors
	independentGradient: false, // define if you want to recalculate the gradient for each new line
	transitionGradient: false,  // define if this is a transition between colors directly
	env: 'node'                 // define the environment cfonts is being executed in
});


console.log(`
**********************************************************
* Welcome to autodartsbot, the automatic dart opponent   *
* for https://autodarts.io                               *
* Currently it only works for X01 games. To play against *
* the bot, just add an opponent with the name            *
* autodartsbot[1-7] to your game. The number determines  *
* the level of the bot with 1 being the best. When no    *
* number is added, a random bot level will be used       *
**********************************************************
`);


/*
const GAME_SERVER_URL = 'http://api.autodarts.io/gs/v0';
const BOARD_SERVER_URL = 'http://api.autodarts.io/bs/v0';
const ANALYTICS_SERVER_URL = 'http://api.autodarts.io/as/v0';
const MESSAGE_SERVER_URL = 'http://api.autodarts.io/ms/v0';
const MESSAGE_SERVER_WS = MESSAGE_SERVER_URL.replace('http', 'ws');
*/

var bot = null;
var player2 = null;
var game = null;
var turnBusy = 0;




const paramsSubscribeLobbiesState = {
    channel: "autodarts.lobbies",
    type: "subscribe",
    topic: "*.events"
}

const keycloakConfig = {
    serverUrl: AUTODART_AUTH_URL,
    realm: AUTODART_REALM_NAME,
    clientId: AUTODART_CLIENT_ID,
    bearerOnly: false,

    /*
        'ssl-required': "external",
        resource: "autodartsbot",
        'public-client': true
    */
}
const keycloak = new Keycloak({}, keycloakConfig)

function getBoardIdFromAutodartsConfig() {
    try {
        if (fs.existsSync(autodartsConfig)) {
            const config = new ConfigParser();
            config.read(autodartsConfig);
            return (config.get('auth', 'board_id'))
        } else {
            return ''
        }
    } catch (e) {
        //console.log("An error occurred.")
    }
}

function writeAutodartsbotConfig(name, password, boardId) {
    const config = new ConfigParser();
    config.addSection('auth');
    config.addSection('board');
    config.set('auth', 'username', name);
    config.set('auth', 'password', password);
    config.set('board', 'board_id', boardId);
    config.write(autodartsbotConfig, true);
    console.log();
    console.log(color.green().bold('Configuration file written to'), color.blue().bold(autodartsbotConfig));
}



async function loginUser(username, password) {
    return await keycloak.grantManager.obtainDirectly(username, password)
        .then(grant => {
            return grant;
        })
        .catch(error => {
            console.log(error);
        });
}

async function getTicket(grant) {
    return await axios.post(AUTODART_AUTH_TICKET_URL, {
        //...data
    },
        {
            headers: {
                'Authorization': 'Bearer ' + grant['access_token']['token']
            }
        })
        .then(ticket => {
            return ticket;
        })
        .catch(error => {
            console.log(error);
        });
}

async function getMatch(grant, matchId) {
    return await axios.get(AUTODART_MATCHES_URL + matchId + '/state', {
        headers: {
            'Authorization': 'Bearer ' + grant['access_token']['token']
        }
    })
        .then(t => {
            return t;
        })
        .catch(error => {
            console.log(error);
        });
}

async function postScore(grant, matchId, segment) {
    return await axios.post(AUTODART_MATCHES_URL + matchId + '/throws', {
        segment
    }, {
        headers: {
            'Authorization': 'Bearer ' + grant['access_token']['token']
        }
    })
        .then(t => {
            return t;
        })
        .catch(error => {
            console.log(error);
        });
}

async function nextPlayer(grant, matchId) {
    return await axios.post(AUTODART_MATCHES_URL + matchId + '/players/next', {
        //data            
    }, {
        headers: {
            'Authorization': 'Bearer ' + grant['access_token']['token']
        }
    })
        .then(t => {
            return t;
        })
        .catch(error => {
            console.log(error);
        });
}

async function undo(grant, matchId) {
    return await axios.post(AUTODART_MATCHES_URL + matchId + '/undo', {
        //data            
    }, {
        headers: {
            'Authorization': 'Bearer ' + grant['access_token']['token']
        }
    })
        .then(t => {
            return t;
        })
        .catch(error => {
            console.log(error);
        });
}

async function resetBoard(grant) {
    return await axios.post(AUTODART_BOARDS_URL + AUTODART_USER_BOARD_ID + '/reset', {
        //data            
    }, {
        headers: {
            'Authorization': 'Bearer ' + grant['access_token']['token']
        }
    })
        .then(t => {
            return t;
        })
        .catch(error => {
            console.log(error);
        });
}

async function connectToWebSocketServer(ticket) {
    const ws = new WebSocket(AUTODART_WEBSOCKET_URL + ticket.data);
    return new Promise((resolve, reject) => {
        const timer = setInterval(() => {
            if (ws.readyState === 1) {
                clearInterval(timer)
                resolve(ws);
            }
        }, 10);
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getGrant(user, pass) {
    await storage.init({
        dir: path.join(homedir, '.autodarts', 'autodartsbot'),
        forgiveParseErrors: true
    });
    let grant = await storage.getItem('grant');
    if (grant) {
        grant = await keycloak.grantManager.createGrant(grant).catch(err => { return null });
        if (grant && grant.isExpired()) {
            if (grant.refresh_token && !grant.refresh_token.isExpired()) {
                grant = await keycloak.grantManager.ensureFreshness(grant);
                await storage.setItem('grant', grant.toString());
            }
            else {
                grant = null;
            }
        }
    }

    if (!grant) {
        grant = await loginUser(user, pass);
        await storage.setItem('grant', grant.toString());
    }
    return grant;
}

async function promptUserDetails() {

    const questions = [
        {
            type: 'text',
            name: 'username',
            message: 'Autodarts username?',
            validate: value => !value || value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ? `Please provide your autodarts username (not email)` : true
        },
        {
            type: 'password',
            name: 'password',
            message: 'Autodarts password?',
            validate: value => !value ? `Please provide your autodarts password` : true
        },
        {
            type: 'text',
            name: 'boardId',
            message: 'Autodarts board id?',
            initial: getBoardIdFromAutodartsConfig(),
            validate: value => !value ? `Please provide your autodarts board ID` : true
        }
    ];
    const onCancel = prompt => {
        process.exit(0);
    }

    const response = await prompts(questions, { onCancel });
    return response;
}

function error(txt) {
    console.log(color.red().bold(`${txt}`));
}

function print(txt) {
    console.log(color.white().bold(txt));
}

const main = async () => {
    if (!fs.existsSync(autodartsbotConfig)) {
        print('');
        error('Unable to locate the autodartsbot configuration file.');
        print('');
        print('Perhaps this is your first time using the autodartsbot.');
        print('Please provide the necessary details below: ');
        print('');
        const userDetails = await promptUserDetails();
        writeAutodartsbotConfig(userDetails.username, userDetails.password, userDetails.boardId);
    }
    const config = new ConfigParser();
    config.read(autodartsbotConfig);

    const AUTODART_USER_NAME = config.get('auth', 'username');
    const AUTODART_USER_PASSWORD = config.get('auth', 'password');
    const AUTODART_USER_BOARD_ID = config.get('board', 'board_id');

    var grant = await getGrant(AUTODART_USER_NAME, AUTODART_USER_PASSWORD);
    const ticket = await getTicket(grant);
    const ws = await connectToWebSocketServer(ticket);
    ws.send(JSON.stringify(paramsSubscribeLobbiesState));

    console.log('');
    console.log('Waiting for new game ...');

    ws.on('message', async function message(data) {
        const msg = JSON.parse(data);
        const channel = msg.channel;
        const topic = msg.topic;

        if (channel === 'autodarts.lobbies' && topic.includes('events') && msg.data.event === 'start') {
            const host = msg.data.body.host.name;
            const players = msg.data.body.players;
            const matchHasBot = players.find(p => p.name.toLowerCase().includes('autodartsbot'));
            const matchId = msg.data.body.id;
            if (host === AUTODART_USER_NAME && matchHasBot) {
                const paramsSubscribeMatch = {
                    channel: "autodarts.matches",
                    type: "subscribe",
                    topic: `${matchId}.*`
                }
                ws.send(JSON.stringify(paramsSubscribeMatch));

                bot = player2 = game = null;

                // send undo because there's no match state sent when match starts
                (async () => {
                    grant = await keycloak.grantManager.ensureFreshness(grant);
                    await storage.setItem('grant', grant.toString());
                    await undo(grant, matchId);
                })();
            }
            else if (host === AUTODART_USER_NAME && !matchHasBot) {
                console.log('');
                console.log('New game detected without bot')
                console.log('');
                console.log('Waiting for new game ...');
            }
        }

        if (channel === 'autodarts.matches') {
            const matchId = msg.data.id;

            // events can only be finish or delete => bot has to be stopped anyway
            if (topic.includes('events')) {
                bot = player2 = game = null;
                const paramsUnsubscribeMatch = {
                    channel: "autodarts.matches",
                    type: "unsubscribe",
                    topic: `${matchId}.*`
                }
                ws.send(JSON.stringify(paramsUnsubscribeMatch));
                console.log('');
                console.log('Waiting for new game ...')
            }


            if (topic.includes('state')) {
                const variant = msg.data.variant;

                if (variant === 'X01') {
                    const matchSettings = msg.data.settings;
                    const baseScore = matchSettings.baseScore;
                    const doubleIn = matchSettings.inMode == 'Straight' ? false : true;
                    const doubleOut = matchSettings.outMode == 'Straight' ? false : true;

                    const players = msg.data.players;
                    const botPlayerIndex = players.findIndex(p => p.name.toLowerCase().includes('autodartsbot'));

                    if (bot === null) {
                        var botLevel = parseInt(players[botPlayerIndex].name.slice(-1));

                        if (isNaN(botLevel) || botLevel < 1 || botLevel > 7) {
                            const min = 1;
                            const max = 7;
                            botLevel = Math.floor(Math.random() * (max - min + 1) + min);
                        }
                        // Create new dartbot
                        let { mean, stdev, name, max } = X01Bot.Players[botLevel];
                        bot = new X01Bot(mean, stdev, name, max);

                        // Create new human Player
                        player2 = new UserPlayer('noob');

                        // Create new game
                        game = new X01Game(baseScore, doubleIn, doubleOut, bot, player2);
                        console.log('');
                        console.log('New game against bot started with:');
                        console.log('   Start points: ' + baseScore);
                        console.log('   Double in: ' + doubleIn);
                        console.log('   Double out: ' + doubleOut);
                        console.log('   Bot level: ' + botLevel);
                        console.log('');
                    }

                    if (msg.data.gameFinished === true) {
                        game = new X01Game(baseScore, doubleIn, doubleOut, bot, player2);
                        console.log('');
                        console.log('Bot ready for new leg ...');
                        console.log('');
                    }

                    var curPlayer = msg.data.player;
                    if ((curPlayer === botPlayerIndex) && msg.data.turns[0].throws === null && turnBusy === 0) {
                        turnBusy = 1;
                        const botPointsLeft = game.Score1.GetPointsLeft();
                        const autodartsPointsLeft = msg.data.gameScores[botPlayerIndex];

                        if (botPointsLeft !== autodartsPointsLeft) {
                            console.log('');
                            console.log('Points for bot and app are not equal.');
                            console.log('Don\'t undo bot scores!!.');
                            console.log('Exiting ...')
                            console.log('');
                            process.exit(0)
                        }

                        bot.TakeTurn(game);
                        const gameFinished = game.IsWon;
                        const hits = game.Score1.GetLastTurn().Hits;
                        console.log('Bot will throw:', hits);
                        (async () => {
                            for (var hit of hits) {
                                await sleep(1000);
                                grant = await keycloak.grantManager.ensureFreshness(grant);
                                await storage.setItem('grant', grant.toString());
                                await postScore(grant, matchId, { name: hit });
                            }

                            if (!gameFinished) {
                                sleep(2000).then(async () => {
                                    grant = await keycloak.grantManager.ensureFreshness(grant);
                                    await storage.setItem('grant', grant.toString());
                                    await nextPlayer(grant, matchId);
                                });
                            }
                            turnBusy = 0;
                        })();
                    }
                }
                else {
                    console.log('');
                    console.log('This bot currently only works for X01 games.');
                    console.log('');
                    console.log('Waiting for new game ...');
                }
            }
        }
    });

    ws.on('close', function close() {
        console.log('disconnected');
    });

}


/*

try {
  if (fs.existsSync(autodartsbotConfig)) {
    console.log("Directory exists.")
  }
  
  else {
    console.log("Directory does not exist.")
  }
} catch(e) {
  console.log("An error occurred.")
}

*/


main().then(() => {
    //process.exit(0)
}, (err) => {
    console.error(err)
    process.exit(1)
})


// console.dir(msg, { showHidden: false, depth: null, colors: true });