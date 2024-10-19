// タブの一覧を取得して表示
chrome.tabs.query({}, function (tabs) {
  const tabList = document.getElementById("tab-list");

  tabs.forEach(function (tab) {
    let li = document.createElement("li");
    let link = document.createElement("a");
    link.href = tab.url;
    link.textContent = tab.title;
    link.target = "_blank"; // 新しいタブでリンクを開く
    li.appendChild(link);
    tabList.appendChild(li);
  });
});
