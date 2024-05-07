export default async (req, res) => {
  try {
    const { body } = req;

    const url = process.env.SAVE_ENDPOINT;

    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Ошибка при перенаправлении запроса', error: error.message });
  }
};
