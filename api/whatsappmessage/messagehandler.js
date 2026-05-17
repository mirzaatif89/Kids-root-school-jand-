const { authenticateToken } = require("../_lib/services");

const sendWhatsAppMessage = async (student , req) => {
  try {
    await axios.post(
      `https://graph.facebook.com/v22.0/PHONE_NUMBER_ID/messages`,
      {
        messaging_product: "whatsapp",
        to: student.parentPhone,
        type: "text",
        text: {
          body: `Happy Birthday ${student.fullName}! 🎉`
        }
      },
      authenticateToken(req)
    );

    console.log("Message sent");
  } catch (error) {
    console.log(error.response?.data || error.message);
  }
};