
const express = require('express');
const app = express();
const { ObjectId } = require('mongodb');


app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const methodOverride = require('method-override')
app.use(methodOverride('_method'))

app.use('/public', express.static('public'));

// 몽고디비 라이브러리 설치하기
// npm install mongodb
const MongoClient = require('mongodb').MongoClient;

var db;
MongoClient.connect('mongodb+srv://chat-mongo:ymiru03240205ryeol@cluster0.psnih.mongodb.net/chat-mongo?retryWrites=true&w=majority', function (err, client) {

  // database 접속이 완료되면 내부코드(node.js 서버띄우기) 실행
  if (err) return console.log(err)

  db = client.db('YM-test');

  app.listen(8080, function () {
    console.log('listening on 8080');
  });
});



// npm install -g nodemon ==> 서버를 자동으로 재실행 해주는 라이브러리
//  (에러가 생길 경우 맨앞에 sudo를 추가)




// npm install passport passport-local express-session
// 라이브러리 첨부
// Session-Based방식 로그인기능 구현
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const { render } = require('express/lib/response');

// 미들웨어 설정하기
// 미들웨어는 웹사이트의 요청-응답 사이에 동작해주는 코드
app.use(session({ secret: '비밀코드', resave: true, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// 로그인 검사
passport.use(new LocalStrategy({
  usernameField: 'userId',
  passwordField: 'userPw',
  session: true,
  passReqToCallback: false,
}, function (input_id, input_pw, done) {

  db.collection('login').findOne({ id: input_id }, function (err, result) {
    if (err) return done(err)


    if (!result) return done(null, false, { message: '존재하지않는 아이디' })
    if (input_pw == result.pw) {
      return done(null, result)
    } else {
      return done(null, false, { message: '비번틀렸어요' })
    }
  })
}));


passport.serializeUser(function (user, done) {
  // user 매개변수에는 result가 들어간다.

  done(null, user.id) // id를 이용해 세션에 저장 후 정보를 쿠키로 전송
});


passport.deserializeUser(function (id, done) {
  db.collection('login').findOne({ id: id }, function (err, result) {
    done(null, result);
  });
})

// 로그인 했는지 확인하는 미들웨어
function connect_login(req, res, next) {
  if (req.user) {
    console.log("connect_login ", req.user._id);
    next()
  } else {
    //res.send('로그인 안함');
    res.redirect('/login');
  }
}


// 회원가입
app.get('/join', function (req, res) {
  res.render('join.ejs', { state: req.params.state });
});
app.post('/join', function (req, res) {

  var create_member_data = {
    id: req.body.userId,
    pw: req.body.userPw,
    nick: req.body.userNickName
  }

  console.log(create_member_data);
  db.collection('login').insertOne(create_member_data, function (err, result){
    console.log(result);
    
    res.redirect('/login');
  })
});

// 로그인 구현
app.get('/login', function (req, res) {
  res.render('login.ejs', { state: req.params.state })
});
app.get('/loginfail', function (req, res) {
  res.render('loginfail.ejs', { state: req.params.state })
});

app.post('/login', passport.authenticate('local', { failureRedirect: '/fail' }),
  function (req, res) {
    // passport : 로그인 기능 쉽게 구현 도와줌
    // local만 쓸경우 : local 방식으로 회원 인증
    // {failureRedirect : '/fail'} : 로그인 실패시 /fail 경로로 이동

    res.redirect('/chat');
  });


// 로그인 실패시
app.get('/fail', function (req, res) {
  res.redirect('/loginfail');
});

// 채팅 페이지
app.get('/chat', connect_login, function (req, res) {

  // 현재 로그인한유저의 _id를 가지고 chatroom컬렉션의 채팅방 목록을 가져옴
  db.collection('chatroom').find({ member: req.user._id }).toArray().then((result) => {

    // 채팅방 목록을 chat.ejs에 넘겨줌
    res.render('chat.ejs', { data: result, my_id: req.user._id, chatrooms: result });

  });
});


app.post('/message', connect_login, function (req, res) {

  var message_data_save = {
    parent: ObjectId(req.body.parent),
    content: req.body.content,
    userid: req.user._id,
    date: new Date()
  }
  db.collection('message').insertOne(message_data_save).then((result) => {
    console.log('메시지 저장 성공');
    res.send("DB 저장 성공");
  }).catch((err) => {
    console.log("db 저장 실패 ", err);
  });
});

app.get('/message/:parentid', connect_login, function (req, res) {

  // 헤더 설정
  // 서버와 유저가 get, post http 요청으로 정보를 주고 받을 때 부가정보도 몰래 전달된다.
  // 유저의 경우 사용하는 브라우저, OS, 쓰는 언어, 보유한 쿠키 등
  // 이런 것을 get요청시 서버로 몰래 전달한다.
  // 반대로 서버도 응답시 유저에게 몰래 서버정보를 전달한다. 
  // 이 정보를 보관하는 곳은 Header 라고 부른다.

  // 유저 -> 서버 이렇게 전달되는 Header는 Request Header,
  // 서버 -> 유저 이렇게 전달되는 Header는 Response Header라고 한다.
  // Header가 어떻게 생겼는지 보고싶으면 크롬 개발자도구 Network 탭가면 된다. 

  // 여러번 응답 가능
  res.writeHead(200, {
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  db.collection('message').find({ parent: ObjectId(req.params.parentid) }).toArray()
    .then((result) => { // [{}, {}, {}] result값은 오브젝트 또는 array 자료형임
      // (참고) 서버에서 실시간 전송시 문자자료만 전송가능하다.
      //console.log("result ==> ", result);
      res.write('event: test\n'); // 이벤트명
      res.write('data: ' + JSON.stringify(result) + '\n\n'); // json 자료형으로
      //render('chat.ejs', { data_id: req.user._id });
    });

  // Change Stream 사용(DB에 update발생 시 자동으로 변경된 내용을 서버로 보내준다)
  // pipeline ==> 찾을 내용
  const pipeline = [
    // 컬렉션 안의 원하는 document만 감시하고 싶으면
    // 이런 document가 추가/삭제/수정 되면 changeStream.on() 함수 실행
    {
      $match: {
        'fullDocument.parent': ObjectId(req.params.parentid)
      }
    }
  ];

  //const changeStream = db.collection('message').watch(pipeline);
  const changeStream = db.collection('message').watch(pipeline); // .watch() ==> 실시간 감지
  changeStream.on('change', (result) => { // 해당 컬렉션에 변동생기면 여기 코드 실행    

    res.write('event: test\n');
    res.write('data: ' + JSON.stringify([result.fullDocument]) + '\n\n');
  });


});

// 채팅방 검색
app.post('/chat', function (req, res) {
  db.collection('chatroom').find().toArray(function (err, result) {
    console.log(result);
    res.render('chat.ejs', { chatrooms: result });
  });
  // var enter_chatroom = {
  //   title: req.body.chatRoomNameSearch
  // }
  // db.collection('chatroom').insertOne(enter_chatroom, function (err, result) {
  //   console.log(result);
  //   //res.send('채팅방 생성 완료');
  //   res.redirect('/chat');
  // });
});

// 채팅방 생성
app.post('/create_room', connect_login, function (req, res) {
  // 유저가 채팅방 제목을 검색하여 채팅방 생성 버튼을 누르면 새로운 채팅방이 개설된다.
  // 채팅방을 만든 유저의 고유 id와(_id) 닉네임, 채팅방 제목을 받아 db에 저장한다

  db.collection('login').findOne({ _id: req.user._id }, function (err, result) {
    var nick = result.nick;

    var create_chatroom_data = {
      title: req.body.chatRoomName,
      member: [req.user._id],
      memberName: [nick]
    }
    db.collection('chatroom').insertOne(create_chatroom_data, function (err, result) {
      console.log(result);
      //res.send('채팅방 생성 완료');
      res.redirect('/chat');
    });
  });
});
