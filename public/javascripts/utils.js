const nodemailer = require('nodemailer');
const config = require('../../config/config_sendMail')
const utils = {};

utils.sendMail = function (receiver, emailKey, req) {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: config.email,
                pass: config.password
            }
        });

        const link = 'http://' + req.get('host') + '/confirmEmail/' + emailKey; //유저에게 보낼 링크

        const mailOption = {
            from: 'adrnmin.hhk@gmail.com',
            to: receiver,
            subject: '대충 이메일 인증하라는 제목',
            html: '<h3>이메일 인증을 하실려면 밑에 링크를 누르세요. </h3><br/>' +
                '<a href="' + link + '"> Push me </a>'
        };

        transporter.sendMail(mailOption, (err, info) => {
            if (err) {
                console.log('mail err : ' + err);
            } else {
                console.log('Email sent : ' + info.response);
            }
        });
    }

module.exports = utils;
