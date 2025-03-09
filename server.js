const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const rsp = express();
const server = http.createServer(rsp);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// 정적 파일 제공
rsp.use(express.static(path.join(__dirname, "public")));

rsp.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

let waitingPlayer = null;
let players = {}; // 닉네임 저장
let rematchRequests = {}; // 재대결 요청 저장
let inRematchVote = {}; // 재대결 투표 상태 관리

io.on("connection", (socket) => {
  console.log(`새로운 플레이어 접속: ${socket.id}`);

  socket.on("setNickname", (nickname) => {
    players[socket.id] = nickname;
    console.log(`플레이어 닉네임 설정: ${nickname} (${socket.id})`);
    
    if (waitingPlayer && waitingPlayer.connected) {
      console.log(`매칭 완료! ${players[waitingPlayer.id]} vs ${nickname}`);
      const player1 = waitingPlayer;
      const player2 = socket;
      waitingPlayer = null;

      player1.emit("matched", { opponent: players[player2.id] });
      player2.emit("matched", { opponent: players[player1.id] });
      inRematchVote[player1.id] = false;
      inRematchVote[player2.id] = false;

      setupGame(player1, player2);
    } else {
      console.log(`${nickname} 대기 중...`);
      waitingPlayer = socket;
    }
  });

  socket.on("disconnect", () => {
    console.log(`플레이어 연결 종료: ${players[socket.id] || socket.id}`);
    delete players[socket.id];
    delete rematchRequests[socket.id];
    delete inRematchVote[socket.id];
    if (waitingPlayer === socket) {
      waitingPlayer = null;
    }
  });

  socket.on("rematch", () => {
    if (!rematchRequests[socket.id]) {
      rematchRequests[socket.id] = true;
      inRematchVote[socket.id] = true;
      console.log(`${players[socket.id]} 재대결 요청!`);
      io.to(socket.id).emit("disableChoices", true); // 선택 비활성화
    }

    const opponentId = Object.keys(rematchRequests).find(id => id !== socket.id);
    if (opponentId) {
      const player1 = io.sockets.sockets.get(socket.id);
      const player2 = io.sockets.sockets.get(opponentId);

      if (player1 && player2) {
        console.log(`재대결 시작: ${players[player1.id]} vs ${players[player2.id]}`);
        player1.emit("rematchConfirmed");
        player2.emit("rematchConfirmed");
        delete rematchRequests[player1.id];
        delete rematchRequests[player2.id];
        inRematchVote[player1.id] = false;
        inRematchVote[player2.id] = false;
        io.to(player1.id).emit("disableChoices", false); // 선택 활성화
        io.to(player2.id).emit("disableChoices", false); // 선택 활성화
        setupGame(player1, player2);
      }
    }
  });
});

function setupGame(player1, player2) {
  const choices = {};
  player1.on("choice", (choice) => {
    if (inRematchVote[player1.id]) return; // 재대결 투표 중이면 선택 불가
    console.log(`${players[player1.id]} 선택: ${choice}`);
    choices[player1.id] = choice;
    if (choices[player2.id]) {
      determineWinner(player1, player2, choices);
    }
  });

  player2.on("choice", (choice) => {
    if (inRematchVote[player2.id]) return; // 재대결 투표 중이면 선택 불가
    console.log(`${players[player2.id]} 선택: ${choice}`);
    choices[player2.id] = choice;
    if (choices[player1.id]) {
      determineWinner(player1, player2, choices);
    }
  });
}

function determineWinner(player1, player2, choices) {
  const nickname1 = players[player1.id];
  const nickname2 = players[player2.id];
  const result = getGameResult(choices[player1.id], choices[player2.id], nickname1, nickname2);
  console.log(`결과: ${result}`);

  player1.emit("result", { result, opponent: nickname2 });
  player2.emit("result", { result, opponent: nickname1 });

  delete choices[player1.id];
  delete choices[player2.id];

  // 재대결 여부 요청 및 선택 비활성화
  player1.emit("rematchRequest");
  player2.emit("rematchRequest");
  io.to(player1.id).emit("disableChoices", true);
  io.to(player2.id).emit("disableChoices", true);
  inRematchVote[player1.id] = true;
  inRematchVote[player2.id] = true;
}

function getGameResult(choice1, choice2, nickname1, nickname2) {
  if (choice1 === choice2) return "무승부";
  if (
    (choice1 === "가위" && choice2 === "보") ||
    (choice1 === "바위" && choice2 === "가위") ||
    (choice1 === "보" && choice2 === "바위")
  ) {
    return `${nickname1} 승리!`;
  } else {
    return `${nickname2} 승리!`;
  }
}

server.listen(3000, () => {
  console.log("✅ 서버 실행 중: http://localhost:3000");
});
