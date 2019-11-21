const express = require('express');
const router = express.Router();
const mariadb = require('mysql');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const moment = require('moment');

let config = {
    host: 'localhost',
    port: 3308,
    user: 'root',
    password: 'root',
    database: 'board',
    multipleStatements: true
};
/* 헤로쿠 cleardb config
let config = {
    host: '',
    port: 3306,
    user: '',
    password: '6bfff666',
    database: 'heroku_9b115f6fb579ce2',
    multipleStatements: true
};*/
const connection = mariadb.createPool(config);

/*
const del = connection._protocol._delegateError;
connection._protocol._delegateError = function(err, sequence){
    if (err.fatal) {
        console.trace('fatal error: ' + err.message);
    }
    return del.call(this, err, sequence);
};
*/
connection.on('error', function () {
});

/* GET List Page */
router.get('/', (req,res) => {
    res.redirect('/board/list/1');
});

router.get('/list', (req,res,next) => {
    res.redirect('/board/list/1');
});

router.get('/list/:page', (req, res, next) => {
    const page_size = 10; //한 페이지당 게시물 10개
    const page_list_size = 10; //페이지 리스트 10개
    let limit = null; //limit 변수
    let totalPageCount = 0; //전체 게시물 개수
    const session = req.session;
    connection.query('SELECT count(*) AS cnt from table_board',  (err, result) => {
        if (err) {
            console.log('err : ' + err);
            return;
        }

        totalPageCount = result[0].cnt; //전체 게시글 개수
        const curPage = req.params.page; //현재 페이지

        if (totalPageCount < 0) {
            totalPageCount = 0;
        }

        const totalPage = Math.ceil(totalPageCount / page_size); //전체 페이지 개수(게시글이 32개면 4페이지)
        const totalSet = Math.ceil(totalPage / page_list_size); //전체 세트 개수(페이지가 22개면 3세트)
        const curSet = Math.ceil(curPage / page_list_size); //현재 세트 번호(현재 페이지가 12페이지면 2세트)
        const startPage = ((curSet - 1) * page_list_size) + 1; //현재 세트내 출력될 시작 페이지
        const endPage = (startPage + page_list_size) - 1; //현재 세트내 출력될 마지막 페이지

        if (curPage < 0) {
            limit = 0; //현재 페이지가 0보다 작으면 0으로 초기화
        } else {
            limit = (curPage - 1) * page_size; //0보다 크면 limit 함수에 들어갈 첫 번째 인자 값(SELECT 할 시작 지점)
        }

        const paging = { //지금까지 구했던 페이징 정보들
            'curPage': curPage,
            'page_list_size': page_list_size,
            'page_size': page_size,
            'totalPage': totalPage,
            'totalSet': totalSet,
            'curSet': curSet,
            'startPage': startPage,
            'endPage': endPage
        };

        connection.query(
            'SELECT pk_board, board_title, board_content, DATE_FORMAT(board_date, "%Y-%m-%d") AS board_date, board_view_count, user_nickname' +
            ' from table_board tb join table_user tu on tb.fk_user_key = tu.pk_user' +
            ' order by pk_board desc limit ?,?',
            [limit, page_size], function (err, rows) {
                if (err) {
                    console.log('err : ' + err);
                    return;
                }
                res.render('list', {title: 'Board List', rows: rows, paging: paging, session: session});
            });
    });
});

/* GET Detail Page */
router.get('/detail/:id', (req, res) => {
    connection.query('select pk_board, board_title, board_content, DATE_FORMAT(board_date, "%Y-%m-%d") AS board_date, user_nickname' +
        ' from table_board tb join table_user tu on tb.fk_user_key = tu.pk_user' +
        ' where pk_board = ?; ' +
        'UPDATE table_board SET board_view_count = board_view_count+1 WHERE pk_board=?',
        [req.params.id, req.params.id], function (err, result) {
            res.render('detail', {title: 'Board Detail', result: result[0][0], session: req.session})
        })
});

/* GET Insert Page */
router.get('/insert', (req, res) => {
    res.render('insert', {title: 'Insert Page', session: req.session})
});

/* POST Insert Page */
router.post('/insert', (req, res) => {
    const data = req.body;
    connection.query(
        'insert into table_board(board_title, board_content, board_date, board_view_count,fk_user_key) VALUES(?,?,now(),0,(SELECT pk_user from table_user WHERE user_nickname = ?))',
        [data.title, data.content, data.nickname],
        function () {
            res.redirect('/board/list');
        })
});

/* GET Modify Page */
router.get('/modify/:id', (req, res) => {
    connection.query('select pk_board, board_title, board_content from table_board where pk_board = ?',
        [req.params.id], function (err, result) {
            res.render('modify', {title: 'Modify Page', result: result[0], session: req.session})
        })
});

/* POST Modify Page */
router.post('/modify', (req, res) => {
    const data = req.body;

    connection.query('UPDATE table_board SET board_title = ?, board_content = ?, board_date = now() WHERE pk_board=?',
        [data.title, data.content, data.id]);
    res.redirect('/board/detail/' + data.id);
});

/* GET Delete Page */
router.get('/delete/:id', (req, res) => {
    connection.query('DELETE from table_board WHERE pk_board = ?', [req.params.id], function (err) {
        if (err) {
            console.log('err : ' + err);
            return;
        }
        res.redirect('/board/list/1');
    })
});
/* GET Login Page */
router.get('/login', (req, res) => {
    const session = req.session;
    res.render('login', {session: session, failLogin: false});
});

/* POST Login Page */
router.post('/login', (req, res) => {
    const data = req.body;
    connection.query('SELECT * from table_user WHERE user_email = ?', [data.email], function (err, result) {
        if (result[0] === undefined) {
            res.render('login', {session: req.session, failLogin: true});
        } else {
            crypto.pbkdf2(data.password, 'salt is very salty', 132184, 64, 'sha512', (err, key) => {
                if (key.toString('base64') === result[0].user_pw) {
                    req.session.nickname = result[0].user_nickname;
                    req.session.point = result[0].point;
                    req.session.access = result[0].email_verified;
                    res.redirect('/board/list')
                } else {
                    res.render('login', {session: req.session, failLogin: true});
                }
            });
        }
    });
});
/* GET Logout Page */
router.get('/logout', (req, res) => {
    req.session.destroy(); //세션 정보를 삭제(session.delete를 사용하길 권장)
    res.clearCookie('sid'); //app.js에서 정했던 key값을 이용해서 쿠키를 삭제
    //res.redirect('back'); //로그아웃이 완료 되면 새로고침
    res.redirect('/board/list/1'); //
});

/* GET Register Page */
router.get('/register', (req, res) => {
    const data = req.query.data;
    if (!(data)) {
        res.render('register', {session: req.session})
    } else if (data) {
        connection.query('SELECT user_nickname from table_user WHERE user_nickname = ?', [data], function (err, result) {
            if (result.length === 0) {
                const output = data + '는 사용 가능한 닉네임입니다.';
                res.render('register', {result: output})
            } else {
                const output = data + '는 이미 사용중입니다.';
                res.send({result: output})
            }
        })
    }
});

/* Post Register Page */
router.post('/register', (req, res) => {
    const data = req.body;

    const key_one = crypto.randomBytes(256).toString('hex').substr(158, 12);
    const key_two = crypto.randomBytes(256).toString('base64').substr(168, 12);
    const key_for_verify = key_one + key_two;

    crypto.pbkdf2(data.password, 'salt is very salty', 132184, 64, 'sha512', (err, key) => {
        connection.query('INSERT INTO table_user VALUES (0,?,?,?,?,0,0,?)', [data.name, data.nickname, data.email, key.toString('base64'), key_for_verify],
            function (err) {
                if (err) {
                    console.log('err : ' + err);
                }
            });
    });
    // TODO: 이메일 보내는 기능을 함수화 해서 사용
    sendMail(data.email, key_for_verify, req);
    /* TODO: 회원가입 이후 afterRegister페이지에서는 로그인이 돼 있는 것 처럼 보이지만 그 상태에서 메인으로를 눌러서 메인페이지로 이동되면 세션이 풀리면서 로그아웃이 되는 현상이 있음 2019-11-12 */
    req.session.nickname = data.nickname;
    req.session.email = data.email;
    req.session.point = '0';
    res.redirect('/afterRegister');

});

/* Get ConfirmEmail Page */
router.get('/confirmEmail/:key', (req, res) => {
    const key = req.params.key;

    connection.query('UPDATE table_user SET email_verified = 1 WHERE email_key = ?',[key], function (err) {
        if(err){
            console.log('err : ' + err);
        }else{
            req.session.access = 1;
            res.render('emailConfirmSuccess',{session : req.session});
        }
    })
});

/* Get AfterRegister Page */
router.get('/afterRegister', function (req, res) {

    res.render('afterRegister', {session: req.session});
});

/* POST NicknameCheck AJAX */
router.post('/nicknameCheck', function (req, res) {
    const data = req.body.data;

    connection.query('SELECT user_nickname from table_user WHERE user_nickname = ?', [data], function (err, result) {
        if (result.length === 0) {
            const output = true;
            res.send({result: output})
        } else {
            const output = false;
            res.send({result: output})
        }
    })
});

/* POST EmailCheck AJAX */
router.post('/emailCheck', function (req, res) {
    const data = req.body.data;

    connection.query('SELECT user_email from table_user WHERE user_email = ?', [data], function (err, result) {
        if (result.length === 0) {
            const output = true;
            res.send({result: output})
        } else {
            const output = false;
            res.send({result: output})
        }
    })
});

/* GET Info Page */
router.get('/info', (req,res) => {
    const session = req.session;
    
    connection.query('SELECT * FROM table_user WHERE user_nickname = ?',[session.nickname], function (err, result) {
        if(err){
            console.log('err : ' + err);
        }
    res.render('info',{result : result[0], session : session})

    })
});

/* GET resendMail Page */
router.get('/resendMail', (req,res) =>{
    const nickname = req.session.nickname;
    console.log(nickname);
    //TODO : 현재 밑 쿼리에 대한 결과 값이 없음. 쿼리 수정 후 이메일 재전송 및 마지막 재전송 날짜와 비교하여 하루 이상 차이가 나지 않을 경우 이메일 재전송을 안 보내도록 수정.
    connection.query('SELECT substr(last_resend,1,4) AS YEAR, substr(last_resend,6,2) AS MONTH, substr(last_resend,9) AS DAY FROM table_user WHERE user_nickname=?',
        [nickname], (result, err)=> {
        if(err){
            console.log('err : ' + err);
        }
            console.log(result);
            /*const year = result[0].YEAR;
            const month = result[0].MONTH;
            const day = result[0].DAY;

            const lastDate = moment([year, month, day]);
            const nowDate = moment().format('YYYY-MM-DD');
            console.log(lastDate);
            console.log(nowDate);*/


    })
});

router.get('/sucesession', (req,res)=>{

    //TODO : 회원탈퇴를 눌렀을 때 회원탈퇴 의사를 한 번 더 확인한 후 회원탈퇴 조치. 회원 탈퇴를 컬럼 삭제를 할지 로우만 암호화 할지는 고민해봐야 됨.
});

function sendMail(receiver, emailKey, req){
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'adrnin.hhk@gmail.com',
            pass: 'password lol'
        }
    });
    const link = 'http://' + req.get('host') + '/confirmEmail/' + emailKey; //유저에게 보낼 링크

    const mailOption = {
        from: 'adrnmin.hhk@gmail.com',
        to: receiver,
        subject: '대충 이메일 인증하라는 제목',
        html: '<h3>이메일 인증을 하실려면 밑에 링크를 누르세요. </h3><br/>' +
            '<a href="'+link+'"> Push me </a>'
    };

    transporter.sendMail(mailOption,(err, info) => {
        if (err) {
            console.log('mail err : ' + err);
        } else {
            console.log('Email sent : ' + info.response);
        }
    });
}
module.exports = router;