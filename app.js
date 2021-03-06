const express=require("express")
const bodyParser=require("body-parser")
const ejs=require("ejs")
const multer=require("multer")
const path=require("path")
const mongoose = require("mongoose")
const session = require('express-session')
const passport = require("passport")
const passportLocalMongoose = require("passport-local-mongoose")
const fs=require("fs")
const cookieParser=require("cookie-parser")
const MongoStore=require("connect-mongo")(session)
const sharp=require("sharp")
/************************* Package End ******************************/ 

const app=express()

/****************************App settings****************************/
app.set("view engine","ejs")
app.use(bodyParser.urlencoded({
    extended:true
}))
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'public')))
app.use(cookieParser())

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({ mongooseConnection: mongoose.connection })
  })
);
app.use(passport.initialize());
app.use(passport.session());
/****************************App settings end****************************/


/****************************Mongo Server****************************/
mongoose.connect("mongodb://localhost:27017/userDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
});
/****************************Mongo Server end****************************/


/****************************User Schema****************************/
const userSchema=new mongoose.Schema({
  username: String,
  password: String,
  pfp:{
      data: Buffer,
      contentType: String
  },
  about: String,
  contact: String,
  totalLikes: Number
});

userSchema.plugin(passportLocalMongoose);

const User=new mongoose.model("User", userSchema);
/****************************User Schema end****************************/


/****************************Post Schema*********************************/
const postSchema=new mongoose.Schema({
    name: String,
    desc: String,
    img:{
        data: Buffer,
        contentType: String
    },
    likes: {
        likesNum: Number,
        likers: [String]
    },
    comments: [Object] 
})

const Post=new mongoose.model("Post",postSchema)
/****************************Post Schema end********************************/

/****************************Passport Settings****************************/
passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
/****************************Passport Settings end****************************/


/****************************Multer Settings****************************/
if (!fs.existsSync("uploads")){
    fs.mkdirSync("uploads");
}
if (!fs.existsSync("profilepics")){
    fs.mkdirSync("profilepics");
}
const storage = multer.diskStorage({
    destination: (req, file, cb)=>{
        if(file.fieldname=="work"){
            cb(null, "uploads")
        }
        else{
            cb(null,"profilepics")
        }
    },
    filename: (req, file, cb)=>{
        if(file.fieldname=="work"){
            cb(null, file.fieldname+'-'+Date.now()+path.extname(file.originalname))
        }
        else{
            cb(null,req.user.username)
        }
    }
})

const imageFilter = (req, file, cb)=>{
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG)$/)){
        req.fileValidationError = 'Only image files are allowed.'
        return cb(new Error('Only image files are allowed.'), false)
    }
    cb(null, true)
}

const upload=multer({storage: storage,fileFilter: imageFilter})
/****************************Multer Settings end****************************/

/****************************Get requests****************************/
app.get("/",(req,res)=>{
    Post.find({}).sort({$natural: -1}).limit(12).exec((err,results)=>{
        if(err) console.log(err)
        else{
            Post.find({}).sort({"likes.likesNum": -1}).limit(5).exec((er,topPosts)=>{
                User.find({}).sort({totalLikes: -1}).limit(5).exec((e,topArtists)=>{
                    if (req.isAuthenticated())
                        res.render("index",{
                            loginDisplay: "none",
                            signupDisplay: "none",
                            logoutDisplay: "inline-block",
                            profileDisplay: "inline-block",
                            username: req.user.username,
                            recentPosts: results,
                            topPosts: topPosts,
                            topArtists: topArtists
                        })
                    else
                        res.render("index",{
                            loginDisplay: "inline-block",
                            signupDisplay: "inline-block",
                            logoutDisplay: "none",
                            profileDisplay: "none",
                            username: "NA",
                            recentPosts: results,
                            topPosts: topPosts,
                            topArtists: topArtists
                        })
                })
            })
        }
    })
})

app.get("/signup", (req, res)=>{
    res.render("signup")
})

app.get("/login",(req,res)=>{
    res.render("login", {errorVisi: "hidden"})
})

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/profile/:username_url", (req, res)=>{
    const username=req.params.username_url;
    User.findOne({username: username},(err,result)=>{
        if(err) console.log(err)
        else{
            if(result){
                const about=result.about
                const contact=result.contact
                const userPfp=result.pfp
                Post.find({name: username}).sort({$natural: -1}).exec((err,results)=>{
                    if(err) console.log(err)
                    else {
                        if(req.isAuthenticated()){
                            if(req.user.username==username)
                                res.render("profile",{
                                    username: username,
                                    about: about,
                                    contact: contact,
                                    pfp: userPfp,
                                    works: results,
                                    loginDisplay: "none",
                                    signupDisplay: "none",
                                    logoutDisplay: "inline-block",
                                    profileDisplay: "inline-block",
                                    sameUser: true,
                                    viewer: req.user.username
                                })
                            else
                                res.render("profile",{
                                    username: username,
                                    about: about,
                                    contact: contact,
                                    pfp: userPfp,
                                    works: results,
                                    loginDisplay: "none",
                                    signupDisplay: "none",
                                    logoutDisplay: "inline-block",
                                    profileDisplay: "inline-block",
                                    sameUser: false,
                                    viewer: req.user.username
                                })
                        }
                        else
                            res.render("profile",{
                                username: username,
                                about: about,
                                contact: contact,
                                pfp: userPfp,
                                works: results,
                                loginDisplay: "inline-block",
                                signupDisplay: "inline-block",
                                logoutDisplay: "none",
                                profileDisplay: "none",
                                sameUser: false,
                                viewer: false
                            })
                    }
                })
            }
            else res.render("404")
        }
    })

});
app.get("/about", function (req, res) {
    if (req.user)
        res.render("about", {
            loginDisplay: "none",
            signupDisplay: "none",
            logoutDisplay: "inline-block",
            profileDisplay: "inline-block",
            username: req.user.username
        })
    else
        res.render("about", {
            loginDisplay: "inline-block",
            signupDisplay: "inline-block",
            logoutDisplay: "none",
            profileDisplay: "none",
            username: "NA"
        })
    
})
app.get("/posts",function(req,res){
    Post.find({}).sort({$natural: -1}).exec((err,results)=>{
        if(err) console.log(err)
        else{
            if (req.user)
                res.render("posts",{
                    loginDisplay: "none",
                    signupDisplay: "none",
                    logoutDisplay: "inline-block",
                    profileDisplay: "inline-block",
                    username: req.user.username,
                    recentPosts: results
                })
            else
                res.render("posts",{
                    loginDisplay: "inline-block",
                    signupDisplay: "inline-block",
                    logoutDisplay: "none",
                    profileDisplay: "none",
                    username: "NA",
                    recentPosts: results
                })
        }
    })
})

app.get("/likepost/:postId",(req,res)=>{
    if(req.isAuthenticated()){
        Post.findById(req.params.postId,(err,result)=>{
            if(err) console.log(err)
            else{
                User.findOne({username: result.name},(err,op)=>{
                    if(err) return console.log(err)
                    let ind=result.likes.likers.indexOf(req.user.username)
                    let btncolour=false
                    if(ind>-1){
                        result.likes.likesNum--
                        op.totalLikes--
                        result.likes.likers.splice(ind,1)
                    }
                    else{
                        result.likes.likesNum++
                        op.totalLikes++
                        result.likes.likers.push(req.user.username)
                        btncolour=true
                    }
                    op.save()
                    result.save()
                    res.send({likes: result.likes.likesNum, colour:btncolour})
                })
            }
        })
    }
    else res.send(false)
})

app.get("/thread/:postId",(req,res)=>{
    Post.findById(req.params.postId,(err,result)=>{
        if(err) console.log(err)
        else{
            let btncolour=false
            let viewer=false
            if(req.isAuthenticated()){
                viewer=req.user.username
                let ind=result.likes.likers.indexOf(req.user.username)
                if(ind>-1) btncolour=true
            }
            res.send({data: result, colour: btncolour, viewer: viewer})
        } 
    })
})

app.get("/deletepost/:postId",(req,res)=>{
    Post.findById(req.params.postId,(err,result)=>{
        if(err) console.log(err)
        else{
            if(req.isAuthenticated() && req.user.username==result.name){
                Post.deleteOne({_id: req.params.postId},(err,placeholder)=>{
                    if(err) console.log(err)
                    else res.send(req.user.username)
                })
            }
            else res.render("404")
        }
    })
})

app.get("/tile/:postId",(req,res)=>{
    Post.findById(req.params.postId,(err,result)=>{
        if(err) res.render("404")
        else{
            if(result){
                let btncolour=false
                let viewer=false
                if(req.isAuthenticated()){
                    let ind=result.likes.likers.indexOf(req.user.username)
                    if(ind>-1) btncolour=true
                    viewer=req.user.username
                    if(req.user.username==result.name){
                        res.render("tile",{
                            tile: result,
                            sameUser: true,
                            colour: btncolour,
                            viewer: viewer
                        })
                    }
                    else
                        res.render("tile",{
                            tile: result,
                            sameUser: false,
                            colour: btncolour,
                            viewer: viewer
                        })
                }
                else
                    res.render("tile",{
                        tile: result,
                        sameUser: false,
                        colour: btncolour,
                        viewer: viewer
                })
                    
            }
            else res.render("404")
        }
    })
})

app.get("/profilephoto",(req,res)=>{
    if(req.isAuthenticated())
        res.render("profilephoto")
})

/****************************Get requests end****************************/

/****************************Post Requests****************************/
app.post("/signup", function (req, res) {
    let regex= /^[a-z0-9]+$/i
    username=req.body.username
    if(!username.match(regex) || username.length<5){
        return res.redirect("/signup")
    }
    about=req.body.about
    contact=req.body.contact
    User.register({
        username: req.body.username,
        about : req.body.about,
        contact: req.body.contact,
        pfp:{
            data: fs.readFileSync(path.join(__dirname +"/Procfile")),
            contentType: "None"
        },
        totalLikes: 0
    }, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/signup");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect(`/profile/${username}`);
            });
        }
    });
});

app.post('/login',(req,res)=>{
    passport.authenticate('local', (err,user)=>{
        if(err) console.log(err)
        else if(!user) res.render("login", {errorVisi: "visible"})
        else{
            req.logIn(user,(err)=>{
                if(err) console.log(err)
                else{
                    if(req.body.remember) 
                        req.session.cookie.originalMaxAge=365*24*60*60*1000
                    else
                        req.session.cookie.expires = false
                    res.redirect(`/profile/${user.username}`)
                } 
            })
        }
    })(req,res)
})

app.post("/submit",upload.single("work"),(req,res)=>{
    if(req.isAuthenticated()){
        sharp("uploads/"+req.file.filename)
            .resize(1000)
            .jpeg({quality: 30})
            .toBuffer((err, sharpData, info)=>{
                let imgObj={
                    name: req.user.username,
                    desc: req.body.desc,
                    img:{
                        data: sharpData,
                        contentType: 'image/png'
                    },
                    likes:{
                        likesNum: 0,
                        likers: []
                    },
                    comments: []
                }
                Post.create(imgObj,(err,result)=>{
                    if(err) console.log(err)
                    else{ 
                        result.save()
                        fs.unlinkSync("uploads/"+req.file.filename)
                        res.redirect(`/profile/${req.user.username}`)
                    }
                })
            })
    }
    else res.redirect("/login") 
})

app.post("/checkusername",(req,res)=>{

    User.findOne({username: req.body.user},(err,result)=>{
        if(err) console.log(err)
        else{
            res.send(result!=null)
        }
    })
})

app.post("/comment/:postId",(req,res)=>{
    if(req.isAuthenticated()){
        Post.findByIdAndUpdate(req.params.postId,{$push:{"comments": {name: req.user.username, comment: req.body.comment}}},{new: true},(err,result)=>{
            res.send({comments: result.comments, viewer: req.user.username})
        })
    }
    else res.send(false)
})

app.post("/deletecomment/:postId",(req,res)=>{
    Post.findById(req.params.postId,(err,result)=>{
        for(let i=0; i<result.comments.length; i++){
            if(result.comments[i].comment==req.body.comment && req.user.username==result.comments[i].name){
                result.comments.splice(i,1)
                break
            }
        }
        result.save()
        res.send({comments: result.comments, viewer: req.user.username})
    })
})

app.post("/searchprofile",(req,res)=>{
    res.redirect("/profile/"+req.body.profile)
})

app.post("/profilephoto",upload.single("pfp"),(req,res)=>{
    User.findOne({username: req.user.username},(err,result)=>{
        if(err) console.log(err)
        else{
            sharp("profilepics/"+req.file.filename)
                .resize(1000)
                .jpeg({quality: 30})
                .toBuffer((err,sharpData,info)=>{
                    result.pfp={
                        data: sharpData,
                        contentType: 'image/png'
                    }
                    result.save()
                    fs.unlinkSync("profilepics/"+req.file.filename)
                    res.redirect("/profile/"+req.user.username)
                })
        }
    })
})
/****************************Post requests end****************************/
app.use((req,res)=>{
    res.status(404).render("404")
})
app.listen(80)
