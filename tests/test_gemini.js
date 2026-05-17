import dotenv from 'dotenv';
dotenv.config();

const url = "https://httpbin.org/post";
const token = process.env.HF_TOKEN;

async function test() {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ inputs: "Hello" })
    });
    console.log("Status:", res.status, res.statusText);
    const txt = await res.text();
    console.log("Body:", txt);
  } catch (e) {
    console.error(e);
  }
}
test();
