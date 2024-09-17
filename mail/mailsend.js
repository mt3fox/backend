const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const mailSender = async (email, title, body, attachments = []) => {
  try {
    const { data, error } = await resend.emails.send({
      from: "mail@areyouwinningson.com",
      to: email,
      subject: title,
      html: body,
      attachments: attachments,
    });

    if (error) {
      console.error(error);
      return null;
    }

    console.log(data);
    return data;
  } catch (error) {
    console.error(error);
    return null;
  }
};

module.exports = mailSender;
