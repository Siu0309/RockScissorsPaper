const socket = io("https://rps-server-production.up.railway.app");

function setNickname() {
    const nickname = document.getElementById("nickname").value.trim();
    if (nickname === "") {
        alert("닉네임을 입력하세요!");
        return;
    }

    socket.emit("setNickname", nickname); // 닉네임 서버로 전송
    document.getElementById("nickname-container").style.display = "none";
    document.getElementById("game-container").style.display = "block";
}

socket.on("matched", (data) => {
    console.log("✅ 매칭 성공! 상대:", data.opponent);
    document.getElementById("status").innerText = `상대: ${data.opponent} 과 매칭됨!`;
    document.getElementById("rematch-container").style.display = "none"; // 기존 재대결 버튼 숨기기
    toggleChoiceButtons(false); // 가위바위보 버튼 활성화
});

document.getElementById("scissors").addEventListener("click", () => sendChoice("가위"));
document.getElementById("rock").addEventListener("click", () => sendChoice("바위"));
document.getElementById("paper").addEventListener("click", () => sendChoice("보"));

function sendChoice(choice) {
    console.log(`내 선택: ${choice}`);
    socket.emit("choice", choice);
    toggleChoiceButtons(true); // 선택 후 비활성화 (중복 선택 방지)
}

socket.on("result", (data) => {
    console.log("🎉 결과:", data.result);
    document.getElementById("result").innerText = `결과: ${data.result}`;
    document.getElementById("rematch-container").style.display = "block"; // 재대결 버튼 표시
});

socket.on("rematchRequest", () => {
    document.getElementById("rematch-container").style.display = "block"; // 재대결 버튼 표시
    toggleChoiceButtons(true); // 재대결 투표 중 버튼 비활성화
});

function requestRematch() {
    console.log("🔄 재대결 요청!");
    socket.emit("rematch");
    document.getElementById("rematch-container").innerText = "상대의 응답을 기다리는 중...";
}

socket.on("rematchConfirmed", () => {
    console.log("🔄 재대결 시작!");
    document.getElementById("result").innerText = "";
    document.getElementById("rematch-container").style.display = "none"; // 다시 숨김
    document.getElementById("status").innerText = "새로운 게임 시작!";
    toggleChoiceButtons(false); // 재대결 후 버튼 활성화
});

// 가위바위보 선택 버튼 활성화/비활성화 함수
function toggleChoiceButtons(disable) {
    document.getElementById("scissors").disabled = disable;
    document.getElementById("rock").disabled = disable;
    document.getElementById("paper").disabled = disable;
}

socket.on("disableChoices", (disable) => {
    toggleChoiceButtons(disable);
});
