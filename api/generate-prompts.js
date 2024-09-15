import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { inputAdminPrompt, inputUserPrompt, model, openaiUrl, openaiApiKey } = req.body;

  try {
    const response = await axios.post(openaiUrl, {
      model: model,
      messages: [
        { role: 'system', content: inputAdminPrompt },
        { role: 'user', content: inputUserPrompt }
      ]
    }, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    res.status(200).json({ generatedPrompt: response.data.choices[0].message.content });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate prompts' });
  }
}