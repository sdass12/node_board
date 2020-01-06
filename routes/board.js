const express = require('express');
const router = express.Router();
const mariadb = require('mysql');
const crypto = require('crypto');
const moment = require('moment');
const utils = require('../public/javascripts/utils');

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
router.get('/', (req, res) => {

    res.redirect('/board/list/1');
});

router.get('/list', (req, res, next) => {
    res.redirect('/board/list/1');
});

router.get('/list/:page', (req, res, next) => {
    const page_size = 10; //한 페이지당 게시물 10개
    const page_list_size = 10; //페이지 리스트 10개
    let limit = null; //limit 변수
    let totalPageCount = 0; //전체 게시물 개수
    const session = req.session;
    connection.query('SELECT count(*) AS cnt from table_board', (err, result) => {
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
    let key_for_verify = key_one + key_two;

    //인증 키에 /가 있을 경우 URL에서 경로로 인식을 해서 404에러가 발생하는 문제를 해결하기 위해 /를 사전에 치환(S는 아무 의미 없음)
    key_for_verify = key_for_verify.replace('\/','S');

    crypto.pbkdf2(data.password, 'salt is very salty', 132184, 64, 'sha512', (err, key) => {
        connection.query('INSERT INTO table_user VALUES (0,?,?,?,?,0,0,?,now())', [data.name, data.nickname, data.email, key.toString('base64'), key_for_verify],
             (err) => {
                if (err) {
                    console.log('err : ' + err);
                }else{
                    //회원가입시 에러가 안 나면 인증 메일을 발송
                    utils.sendMail(data.email, key_for_verify, req);
                }
            });
    });


    req.session.nickname = data.nickname;
    req.session.email = data.email;
    req.session.point = '0';
    res.redirect('/afterRegister');

});

/* Get ConfirmEmail Page */
router.get('/confirmEmail/:key', (req, res) => {
    const key = req.params.key;
    //TODO : 인증이 완료됐건 안 됐건 이메일 인증이 완료됐다는 페이지가 노출됨. 페이지를 렌더링할 때 boolean 값을 하나 같이 보내서 이메일 인증 여부를 보여줘야 됨. 2019-12-19
    connection.query('UPDATE table_user SET email_verified = 1 WHERE email_key = ?', [key], function (err) {
        if (err) {
            console.log('err : ' + err);
        } else {
            req.session.access = 1;
            res.render('emailConfirmSuccess', {session: req.session});
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
router.get('/info', (req, res) => {
    const session = req.session;

    connection.query('SELECT * FROM table_user WHERE user_nickname = ?', [session.nickname], function (err, result) {
        if (err) {
            console.log('err : ' + err);
        }
        res.render('info', {result: result[0], session: session})

    })
});

/* GET resendMail Page */
router.get('/resendMail', (req, res) => {
    const nickname = req.session.nickname;

    connection.query('SELECT substr(last_resend,1,4) AS YEAR, substr(last_resend,6,2) AS MONTH, substr(last_resend,9) AS DAY FROM table_user WHERE user_nickname=?',
        [nickname], (err, result) => {
            if (err) {
                console.log('err : ' + err);
            }

            const year = result[0].YEAR;
            const month = result[0].MONTH;
            const day = result[0].DAY;

            console.log(year + month + day);
            const lastDate = moment([year, month - 1, day]);
            const nowDate = moment();

            console.log(lastDate);
            console.log(nowDate);
            const diffDay = nowDate.diff(lastDate, 'days');
            console.log(diffDay);

            //TODO : 하루 이상 차이가 나면 이메일 재인증을 해주고 lastday를 오늘로 바꿔주는 쿼리를 날림. 차이가 안 나면 경고창을 띄우고 리턴.
            if (diffDay >= 1) {
                console.log('하루이상 차이남.')

            } else {
                console.log('오늘 시도했음.')
            }

        })
});

router.get('/sucesession', (req, res) => {

    //TODO : 회원탈퇴를 눌렀을 때 회원탈퇴 의사를 한 번 더 확인한 후 회원탈퇴 조치. 회원 탈퇴를 컬럼 삭제를 할지 데이터만 암호화 할지는 고민해봐야 됨.
});

module.exports = router;
