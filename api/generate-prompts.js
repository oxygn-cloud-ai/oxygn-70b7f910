import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { inputAdminPrompt, inputUserPrompt, model, openaiUrl, openaiApiKey } = req.body;

  console.log('OpenAI API Request:', {
    url: openaiUrl,
    model: model,
    messages: [
      { role: 'system', content: inputAdminPrompt },
      { role: 'user', content: inputUserPrompt }
    ]
  });

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

    console.log('OpenAI API Response:', JSON.stringify(response.data, null, 2));

    res.status(200).json({ 
      generatedPrompt: response.data.choices[0].message.content,
      fullResponse: response.data
    });
  } catch (error) {
    console.error('Error calling OpenAI API:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate prompts', details: error.message });
  }
}
