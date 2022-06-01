
const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

const methodOverride = require('method-override')
app.use(methodOverride('_method'))

app.use('/public', express.static('public'));

// 몽고디비 라이브러리 설치하기
// npm install mongodb
const MongoClient = require('mongodb').MongoClient;

var db;
MongoClient.connect('mongodb+srv://chat-mongo:ymiru03240205ryeol@cluster0.psnih.mongodb.net/chat-mongo?retryWrites=true&w=majority', function(err, client){
    
    // database 접속이 완료되면 내부코드(node.js 서버띄우기) 실행
    if(err) return console.log(err)

    db = client.db('YM-test');

    app.listen(8080, function(){
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
app.use(session({secret : '비밀코드', resave : true, saveUninitialized: false}));
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


passport.serializeUser(function(user, done){
    // user 매개변수에는 result가 들어간다.

    done(null, user.id) // id를 이용해 세션에 저장 후 정보를 쿠키로 전송
});


passport.deserializeUser(function(id, done){
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
  res.render('join.ejs', { state: req.params.state })
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
app.get('/fail', function(req, res){
    res.redirect('/loginfail');
});


// 채팅 페이지
app.get('/chat', connect_login, function(req, res){

  // 현재 로그인한유저의 _id를 가지고 chatroom컬렉션의 채팅방 목록을 가져옴
  db.collection('chatroom').find({member: req.user._id}).toArray().then((result)=>{ 

    // 채팅방 목록을 chat.ejs에 넘겨줌
    res.render('chat.ejs', { data: result, my_id: req.user._id });
    
  });
});


const {ObjectId} = require('mongodb');
app.post('/chatroom',function(req, res){

    var data = {
        title : '무슨무슨채팅방',
        member : [ObjectId(req.body.당한사람id), req.user._id],
        date : new Date()
    }

    db.collection('chatroom').insertOne(data).then(function(result){
        res.send('저장완료');
    });
});