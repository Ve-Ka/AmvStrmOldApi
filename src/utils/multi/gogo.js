// CODE FROM CONSUMET.TS WITH MODIFICATION CHANGES

import axios from "axios";
import { load } from "cheerio";
import CryptoJS from "crypto-js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/97.0.4692.71 Safari/537.36";
const keys = {
  key: CryptoJS.enc.Utf8.parse("37911490979715163134003223491201"),
  secondKey: CryptoJS.enc.Utf8.parse("54674138327930866480207815084989"),
  iv: CryptoJS.enc.Utf8.parse("3134003223491201"),
};

let referer = "";
export const extract = async (id) => {
  const BASE_URL = "https://www1.gogoanime.bid/";
  const datapage = await axios.get(`${BASE_URL}` + id, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  const x$ = load(datapage.data);
  const title = x$('.anime_video_body_cate > .anime-info > a').attr('title');
  const ani_id = x$('.anime_video_body_cate > .anime-info > a').attr('href').replace('\/category\/', '');
  const server = x$("#load_anime > div > div > iframe").attr("src");
  const videoUrl = new URL("https:" + server);

  referer = videoUrl.href;
  const res = await axios.get(videoUrl.href, {
    headers: {
      "User-Agent": USER_AGENT,
    },
  });
  const $ = load(res.data);
  try {
    const encyptedParams = await generateEncryptedAjaxParams(
      $,
      videoUrl.searchParams.get("id") ?? ""
    );
    const encryptedData = await axios.get(
      `${videoUrl.protocol}//${videoUrl.hostname}/encrypt-ajax.php?${encyptedParams}`,
      {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      }
    );
    const decryptedData = await decryptAjaxData(encryptedData.data.data);
    if (!decryptedData.source)
      throw new Error("No source found. Try a different server.");
    let sources = [];
    decryptedData.source.forEach((source) => {
      sources.push({
        url: source.file,
        isM3U8: source.file.includes(".m3u8"),
        quality: "default",
      });
    });

    decryptedData.source_bk.forEach((source) => {
      sources.push({
        url: source.file,
        isM3U8: source.file.includes(".m3u8"),
        quality: "backup",
      });
    });
    return {
      info: {
        title,
        id: ani_id,
        episode: id.split('-episode-')[1]
      },
      sources,
      tracks: decryptedData.track.tracks,
      iframe: {
        default: videoUrl.href,
        backup: decryptedData.linkiframe,
      },
    };
  } catch (e) {
    console.log(e);
    throw new Error("Somthing went wrong" + ": " + e);
  }
};

export const addSources = async (source) => {
  if (source.file.includes("m3u8")) {
    const m3u8Urls = await axios
      .get(source.file, {
        headers: {
          Referer: referer,
          "User-Agent": USER_AGENT,
        },
      })
      .catch(() => null);

    const videoList = m3u8Urls?.data.split("#EXT-X-I-FRAME-STREAM-INF:");
    for (const video of videoList ?? []) {
      if (!video.includes("m3u8")) continue;

      const url = video
        .split("\n")
        .find((line) => line.includes("URI="))
        .split("URI=")[1]
        .replace(/"/g, "");

      const quality = video.split("RESOLUTION=")[1].split(",")[0].split("x")[1];

      sources.push({
        url: url,
        quality: `${quality}p`,
        isM3U8: true,
      });
    }

    return sources;
  }
  sources.push({
    url: source.file,
    isM3U8: source.file.includes(".m3u8"),
  });
};

export const generateEncryptedAjaxParams = async ($, id) => {
  const encryptedKey = CryptoJS.AES.encrypt(id, keys.key, {
    iv: keys.iv,
  });
  const scriptValue = $("script[data-name='episode']").data().value;
  const decryptedToken = CryptoJS.AES.decrypt(scriptValue, keys.key, {
    iv: keys.iv,
  }).toString(CryptoJS.enc.Utf8);
  return `id=${encryptedKey}&alias=${id}&${decryptedToken}`;
};

export const decryptAjaxData = async (encryptedData) => {
  const decryptedData = CryptoJS.enc.Utf8.stringify(
    CryptoJS.AES.decrypt(encryptedData, keys.secondKey, {
      iv: keys.iv,
    })
  );

  return JSON.parse(decryptedData);
};

export default {
  extract,
  addSources,
  generateEncryptedAjaxParams,
  decryptAjaxData,
};
