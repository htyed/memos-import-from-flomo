const fs = require("fs-extra");
const cheerio = require("cheerio");
const { htmlPath, getFilePath, mergePromise } = require("./utils/utils");
const { uploadFile, sendMemo } = require("./utils/api");

const sendedMemoIds = [];
const memoArr = [];

const $ = cheerio.load(fs.readFileSync(htmlPath, "utf8"));

const memos = $(".memo");

for (const memo of memos) {
  const time = $(memo).find(".time").text();
  let content = "";
  let files = [];

  $(memo)
    .find(".content p")
    .each((index, p) => {
      let text = $(p).html();

      text = text.replaceAll("<strong>", "**").replaceAll("</strong>", "**");

      content += `${content ? "\n" : ""}${text}`;
    }, "");

  $(memo)
    .find(".files img")
    .each((index, img) => {
      const src = $(img).attr("src");
      files.push(src);
    });

  memoArr.push({
    time,
    content,
    files,
  });
}

memoArr.sort((a, b) => {
  return new Date(b.time) - new Date(a.time);
});

async function uploadFileHandler() {
  console.log("======================= 上传资源 =======================");
  for (const memo of memoArr) {
    memoArr.resourceList = memoArr.resourceList || [];
    const uploadFilePromiseArr = [];
    if (memo.files.length) {
      for (const filePath of memo.files) {
        const fullPath = getFilePath(filePath);
        uploadFilePromiseArr.push(() => {
          console.log("开始上传", filePath);
          return uploadFile(fullPath);
        });
      }
    }

    await mergePromise(uploadFilePromiseArr).then((res) => {
      memo.resourceIdList = res.map((item) => item.id);
    });
  }

  console.log("======================= 上传资源 end =======================");
}

async function sendMemoHandler() {
  const sendMemoPromiseArr = [];

  for (const memo of memoArr) {
    sendMemoPromiseArr.unshift(() =>
      sendMemo({
        content: memo.content,
        resourceIdList: memo.resourceIdList,
        createdTs: new Date(memo.time).getTime() / 1000,
      }).then((res) => {
        console.log("success", res.data.content);
        sendedMemoIds.push(res.data.id);
      })
    );
  }

  await mergePromise(sendMemoPromiseArr);

  fs.writeJSONSync("./memo.json", memoArr);
  fs.writeJSONSync("./sendedIds.json", sendedMemoIds);
}

uploadFileHandler().then(sendMemoHandler);
