const OpenAI = require('openai');

const SYSTEM_PROMPT = `你是报销信息提取助手。从用户输入（文字或票据图片）中提取报销信息，只返回 JSON，不含任何其他内容。

格式：
{
  "date": "YYYY-MM-DD",
  "amount": 数字（人民币元，不含符号）,
  "type": "交通费|餐饮费|住宿费|通讯费|办公用品|其他 之一",
  "vendor": "商家或平台名称",
  "reason": "报销事由（一句话）"
}

无法确定时：日期用今天，amount 用 0，其余用空字符串。`;

async function extract(apiKey, contentType, content) {
  const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
  const userMessage = contentType === 'text'
    ? { role: 'user', content }
    : { role: 'user', content: [
        { type: 'image_url', image_url: { url: content } },
        { type: 'text', text: '请识别这张票据并提取报销信息。' }
      ]};

  const response = await client.chat.completions.create({
    model: 'google/gemini-2.0-flash-001',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, userMessage]
  });

  const raw = response.choices[0].message.content.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM did not return valid JSON');
  return JSON.parse(match[0]);
}

module.exports = { extract };
