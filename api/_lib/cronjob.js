const cron = require("node-cron");
const { defineStudentModel } = require("./db.js");
const axios = require("axios");

cron.schedule("0 9 * * *", async (req) => {
  try {
    const today = new Date(); // get current date 

    const day = today.getDate(); // get current Day
    const month = today.getMonth() + 1; // find current date month

    const students = await defineStudentModel.find();

    for (const student of students) {
      const dob = new Date(defineStudentModel.dob);

      if (
        dob.getDate() === day && // get day of current date
        dob.getMonth() + 1 === month //     get current month
      ) {
        await sendWhatsAppMessage(student , req);
      }
    }
  } catch (error) {
    console.log(error);
  }
});