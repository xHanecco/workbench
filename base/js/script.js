// DOM（HTMLの構造）が完全に読み込まれた後に実行されるようにします
document.addEventListener('DOMContentLoaded', () => {

    // HTMLから操作したい要素を取得します
    const actionButton = document.getElementById('actionButton');
    const message = document.getElementById('message');
    const heading = document.querySelector('h1');

    // ボタンがクリックされたときのイベント処理を登録します
    actionButton.addEventListener('click', () => {
        // 見出しのテキストを変更します
        heading.textContent = 'ようこそ！';

        // メッセージのテキストを変更し、スタイルを適用するためのクラスを追加します
        message.textContent = 'ボタンがクリックされました！JavaScriptが動作しています。';
        message.classList.add('highlight');
    });

});
