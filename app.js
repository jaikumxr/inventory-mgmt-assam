const bodyParser = require("body-parser"),
  methodOverride = require("method-override"),
  express = require("express"),
  app = express(),
  mongoose = require("mongoose"),
  passport = require("passport"),
  LocalStrategy = require("passport-local"),
  User = require("./models/user") ,
  needle = require("needle"),
  fs = require("fs"), 
  flash = require("connect-flash"),
  Item = require("./models/item"),
  Alert = require("./models/alert"),
  json2xls = require('json2xls'),
  pdf = require('pdf').pdf;

const nodemailer = require("nodemailer");
const transporter = nodemailer.createTransport({
  host: 'smtp.ethereal.email',
  port: 587,
  auth: {
      user: 'jaime.pollich@ethereal.email',
      pass: 'XesV4C5VB6PeFA42yt'
  }
});


mongoose.connect("mongodb://localhost:27017/ims", {
  useNewUrlParser: true,
  'useUnifiedTopology': true
});
mongoose.set('useFindAndModify', false);

var connection = mongoose.connection;

// APP CONFIG

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(methodOverride("_method"));
app.use(flash());

// RESTFUL ROUTES

app.use(require("express-session")({
  secret: "masteroogway",
  resave: false,
  saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(function(req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

app.get("/", function(req, res) {
  res.redirect("/home");
});

app.post("/import", isLoggedIn, function(req, res) {
  res.redirect("/");
});

//index route
app.get("/home", isLoggedIn, function(req, res) {
  res.render("home", {
    currentUser: req.user
  });
});

app.get("/inventory", isLoggedIn, function(req, res){
  Item.find({},function(err, items){
    res.render("inventory", {
      currentUser: req.user,
      items: items,
      editEnable: false
    })
  })
});

app.get("/inventory/item/:id", isLoggedIn, function(req, res){
  Item.findById(req.params.id, function(err1, item){
    User.findById(item.addedBy, function(err2, adder){
      res.render("showItem",{
        currentUser: req.user,
        items: [
          {
            itemObj: item,
            adder: adder,
          }
        ],
        result: false
      })
    })
  })
})

app.get("/search", isLoggedIn, function(req, res){
  res.render("search",{
    currentUser: req.user
  })
})

app.post("/search/id", isLoggedIn, function(req, res){
  const renderItems = []
  try{
    Item.find({itemid: (req.body.itemid ? req.body.itemid : 0)}, function(err, items){
      if(err){
        console.log(err);
      } else {
        items.forEach(function(item){
          renderItems.push({itemObj: item})
        })
        if(items.length>0){
          return res.render("showItem", {
            currentUser: req.user,
            items: renderItems,
            result: true,
            error: (renderItems.length>1?"Multiple entries found with the same ID. Please update database":null),
            success: (renderItems.length==1?"Found 1 item":null)
          })
        } else {
          req.flash("error","No items found with this ID");
          return res.redirect("/search");
        }
      }
    })  
  }
  catch(err){
    req.flash("error","An error occured. Please try again")
    res.redirect("/search")
    console.log(err);
  }
})

app.post("/search/parameters", isLoggedIn, function(req, res) {
  searchObj = {
    "lastModifiedDate": {
      $gt: (new Date(req.body.first)).toJSON(),
      $lt: (new Date(req.body.second)).toJSON()
    },
    itype: req.body.type
  }
  if(req.body.type=="Other"){
    delete searchObj.itype;
  }
  Item.find(searchObj, function(err, result) {
      if (err) {
        console.log(err);
      } else {
        if (result.length > 0) {
          const renderItems = []
          result.forEach(function(item){
            renderItems.push({
              itemObj: item
            })
          });
          return res.render("showItem", {
            items: renderItems,
            success: "No. of items found: " + result.length,
            result: true
          });
        } else {
          req.flash("error", "No items found. Please check your search criteria.");
          return res.redirect("/search");
        }
      }
  });
});


app.get("/inventory/manage", isLoggedIn, function(req, res){
  res.render("manage",{
    currentUser: req.user 
  })
})

app.get("/inventory/add", isLoggedIn, function(req, res){
  res.render("new",{
    currentUser: req.user
  })
})

app.post("/inventory/add", isLoggedIn, function(req, res){
  const newDate = new Date()
  const addObj = {
    itemid: req.body.itemid,
    iname: req.body.iname,
    itype: req.body.itype,
    icount: req.body.icount,
    location: req.body.location,
    publishedDate: newDate,
    lastModifiedDate: newDate,
    addedBy: req.user._id,
    modList: [
      {
        user: req.user._id,
        modDate: newDate
      }
    ]
  }

  Alert.updateMany({},{items:[],count:0}, function(err, response){
    if(err){
      console.log(err);
    } else {
      console.log('Cleared alerts.');
    }
  });


  Alert.find({}, (err, alerts)=>{
    if(err){
      console.log(err);
    } else {
      alerts.forEach((alert)=>{
        let counter = false;
        if(alert.value==addObj.iname||alert.value==addObj.itype||alert.value==addObj.location){
          counter = true;
        }
        if(counter){
          Alert.findOneAndUpdate({value:alert.value},{$push: {items: addObj.itemid}}, (err)=>{
            if(err){
              console.log(err);
            }
          })
        }
      })
      function mailer() {
        setTimeout(function(){ 
        let subUsers = []; 
        Alert.find({}, function(err, alerts){
          if(err){
            console.log(err);
          } else {
            alerts.forEach(function(alert){
              alert.users.forEach((user)=>{
                subUsers.push({userid:user, keyword: alert.value , items:alert.items});
              });
            });
            subUsers.forEach(function(item){
              console.log(item.userid);
              User.findById(item.userid, function(err, foundUser){
                if(foundUser){
                  console.log("Sending mail to "+foundUser.email);
                  let mailOptions = {
                    from: "noreply@ims",
                    to: foundUser.email,
                    subject: "New item from your subscription",
                    text: `
                    Dear ` +foundUser.username +`,
                    This is an auto-generated email.
                    There is a new item from one of your subscribed keyword:  `+ item.keyword +`     
                    Thanks
                    IMS
                    `  
                  }
                  transporter.sendMail(mailOptions, function(err, data){
                    if(err){
                        console.log(err);
                    } else {
                        console.log("Email Sent");
                    }
                  });
                } else {
                  console.log("No user found "+item.userid);
                }
              });
            });
          }
        });
        }, 20000); //a timer of 20 seconds has been added before mailing to ensure that the DB is updated correctly.
      }

      mailer();
    }
  })



  Item.create(addObj, function(err){
    if(err){
      console.log(err);
      req.flash("error","Something went wrong. Please try again");
      res.redirect("/home");
    } else {
      req.flash("success","Successfully added "+addObj.iname+" to inventory")
      res.redirect("/home");
    }
  })
})

app.get("/inventory/edit", isLoggedIn, function(req, res){
  Item.find({},function(err, items){
    res.render("inventory", {
      currentUser: req.user,
      items: items,
      editEnable: true
    })
  })
})

app.get("/inventory/edit/:id", isLoggedIn, function(req, res){
  Item.findById(req.params.id, function(err, item){
    if(err){
      console.log(err);
    } else {
      res.render("editItem", {
        currentUser: req.user,
        item: item
      })
    }
  })
});

app.put("/inventory/edit/:id", isLoggedIn, function(req, res){
  const newDate = new Date()
  const addObj = {
    itemid: req.body.itemid,
    iname: req.body.iname,
    itype: req.body.itype,
    icount: req.body.icount,
    location: req.body.location,
    lastModifiedDate: newDate,
    $push: {
      modList: {user: req.user._id, modDate: newDate}
    }
  }
  Item.findByIdAndUpdate(req.params.id, addObj, function(err){
    if(err){
      console.log(err);
    } else {
      req.flash("success","Successfully edited "+req.body.iname)
      res.redirect("/inventory");
    }
  })
})

app.delete("/inventory/remove/:id", isLoggedIn, function(req, res) {
  Item.findByIdAndRemove(req.params.id, function(err){
    if(err){
      req.flash("error","Could not remove item");
      res.redirect("/inventory")
    } else {
      req.flash("success", "Removed item");
      res.redirect("/inventory");
    }
  });
});

app.get('/subscriptions', isLoggedIn, function(req, res){
  let allSubs = []
  Alert.find({}, (err, result)=> {
    if(err){
      console.log(err);
    } else {
      allSubs = result
    }
  })
  Alert.find({users: req.user._id}, (err, result)=> {
    if(err){
      console.log(err);
    } else {
      console.log(result);
      res.render('subscriptions',{
        currentUser: req.user,
        subs: result,
        allSubs: allSubs
      })
    }
  })
})

app.post('/subscribe', isLoggedIn, (req, res) => {
  Alert.findOneAndUpdate({value: req.body.keyword}, {$push:{users: req.user._id}}, (err)=>{
    if(err){
      console.log(err);
      req.flash("error","Could not subscribe. Keyword does not exist");
      res.redirect("/subscriptions");
    } else {
      req.flash("success","Successfully subscribed to "+req.body.keyword);
      res.redirect("/subscriptions");
    }
  })
})
app.post('/unsubscribe', isLoggedIn, (req, res) => {
  Alert.findOneAndUpdate({value: req.body.keyword}, {$pull:{users: req.user._id}}, (err)=>{
    if(err){
      console.log(err);
      req.flash("error","Could not unsubscribe. Keyword does not exist");
      res.redirect("/subscriptions");
    } else {
      req.flash("success","Successfully unsubscribed from "+req.body.keyword);
      res.redirect("/subscriptions");
    }
  })
})

app.post("/togglelang", isLoggedIn, (req, res)=>{
  User.findById(req.user._id, (err,user)=>{
    if(err){
      console.log(err);
    } else {
      User.findByIdAndUpdate(req.user._id, {assamese: !user.assamese}, (err)=>{
        if(err){
          console.log(err);
        } else {
          req.flash("success","Success! | সফল!")
          res.redirect("/home")
        }
      })
    }
  })
})


//admin Dashboard
app.get("/dashboard", isLoggedIn, function(req, res) {
  User.find({}, function(err, users) {
    if (err) {
      console.log(err);
    } else {
      res.render("dashboard", {
        users: users,
        currentUser: req.user,
      });
    }
  });
});

app.get("/dashboard/subscriptions", isLoggedIn, function(req, res){
  Alert.find({}, function(err, response){
    if(err){
      console.log(err);
    } else {
    res.render("subedit",{
      currentUser:req.user,
      subs: response
    });
    }
  });
});

app.post("/dashboard/subscriptions", isLoggedIn, function(req, res){
  Alert.create({
    value: req.body.subname,
    type: req.body.type,
    users: [],
    items: []
  }, function(err, response){
    if(err){
      console.log(err);
    }
  });
  res.redirect("/dashboard/subscriptions");
});

app.delete("/dashboard/subscriptions/:id", isLoggedIn, function(req, res) {
  Alert.findByIdAndRemove(req.params.id, function(err) {
    if (err) {
      req.flash("error", "Could not remove Item/Location");
      res.redirect("/dashboard/subscriptions");
    } else {
      req.flash("success", "Removed Item/Location");
      res.redirect("/dashboard/subscriptions");
    }
  });
});

//export routes

app.post("/search/export/excel", isLoggedIn, function(req, res){
  try{
    xls=[]
    const sresult = JSON.parse(req.body.items)
    sresult.forEach(function(item){
      xls.push({
        "Item ID": item.itemObj.itemid,
        "Item Name": item.itemObj.iname,
        "Count": item.itemObj.icount,
        "Published Date": (new Date(item.itemObj.publishedDate)).toDateString(),
        "Last Modified": (new Date(item.itemObj.lastModifiedDate)).toDateString(),
        "Type": item.itemObj.itype,
        "Location": item.itemObj.location
      })
    })
    xls = json2xls(xls)

    fs.writeFileSync('result.xlsx', xls, 'binary');
    return res.download('./result.xlsx')
  }
  catch(err){
    console.log(err);
  }
})

app.post("/search/export/pdf", isLoggedIn, function(req, res){
  try{ 
    sresult = JSON.parse(req.body.items)
    doc = new pdf();
    doc.setFontSize(12);
    sresult.forEach(function(item){
      x=20;
      doc.text(20,x, "Item ID: "+item.itemObj.itemid);
      x+=10;
      doc.text(20,x, "Item Name: "+item.itemObj.iname);
      x+=10;
      doc.text(20,x, "Item Count: "+item.itemObj.icount);
      x+=10;
      doc.text(20,x, "Item Location: "+item.itemObj.location);
      x+=10;
      doc.text(20,x, "Item Type: "+item.itemObj.itype);
      x+=10
      doc.text(20,x, "Published on: "+(new Date(item.itemObj.publishedDate).toDateString()))
      x+=10
      doc.text(20,x, "Last modified on: "+(new Date(item.itemObj.lastModifiedDate).toDateString()))
      doc.addPage();
    })
    fs.writeFileSync("result.pdf", doc.output(), function(){} )
    return res.download("result.pdf")
  }
  catch(err){
    console.log(err);
  }
})

//uncomment this to create initial admin user

// var newUser = {"username":"admin","isAdmin":true,"email":"jai@example.com"};
// var password = "admin";
// User.register(newUser, password, function(err,user){
//   if(err){
//     console.log(err);
//   }
// });

//AUTH ROUTES

//show signup form
app.get("/dashboard/createuser", function(req, res) {
  res.render("register");
});

//handle signup logic
app.post("/dashboard/createuser", function(req, res) {

  const {username, password, email, firstName, lastName, confirmpassword} = req.body;
  let errors = [];

  if (!username || !password || !email) {
    errors.push({ msg: 'Please enter all required fields' });
  }
  
  var paswd=  /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{7,15}$/;
  
  if(!password.match(paswd)){ 
      errors.push({msg: "Enter a password between 7 to 15 characters which contains at least one numeric digit and a special character."});
      }
  
  if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email))
  {
    errors.push({msg: "Please enter a valid email"})
  }
  
  if (password != confirmpassword){
    errors.push({msg: "Both passwords are different. Kindly enter same password in the Confirm Password field."})
  }

  if (errors.length > 0) {
    req.flash("error", errors[0].msg);
    res.redirect("/dashboard/createuser");
  } else {
    var newUser = new User({
      username: req.body.username
    });
    if (req.body.role === "admin") {
      newUser.isAdmin = "true"
    }
    newUser.lastName = lastName;
    newUser.firstName = firstName;
    newUser.email = email;
    User.register(newUser, req.body.password, function(err) {
      if (err) {
        console.log(err);
        return res.redirect("/dashboard/createuser");
      }
      req.flash("success", "Successfully created user: " + req.body.username);
      res.redirect("/dashboard");
    });
  }
});

app.get("/dashboard/:id/edituser", isLoggedIn, function(req, res) {
  User.findById(req.params.id, function(err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      res.render("edit", {
        user: foundUser,
      });
    }
  });
});

app.put("/dashboard/:id", isLoggedIn, function(req, res) {
  
  const {username, password, email, firstName, lastName, confirmpassword} = req.body;
  let errors = [];

  if (!username || !password || !email) {
    errors.push({ msg: 'Please enter all required fields' });
  }

  var paswd=  /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{7,15}$/;
  
  if(!password.match(paswd)){ 
      errors.push({msg: "Enter a password between 7 to 15 characters which contains at least one numeric digit and a special character."});
      }
  
  if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email))
  {
    errors.push({msg: "Please enter a valid email"})
  }
  
  if (password != confirmpassword){
    errors.push({msg: "Both passwords are different. Kindly enter same password in the Confirm Password field."})
  }

  if (errors.length > 0) {
    req.flash("error", errors[0].msg);
    res.redirect("/dashboard/"+req.params.id+"/edituser");
  } else {
    User.findByIdAndRemove(req.params.id, function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log("Updating user...");
      }
    });
    var newUser = new User({
      username: req.body.username,
      lastName: req.body.lastName,
      firstName: req.body.firstName,
      email: req.body.email,
    });
    if (req.body.role === "admin") {
      newUser.isAdmin = "true"
    }
    User.register(newUser, req.body.password, function(err) {
      if (err) {
        console.log(err);
        return res.redirect("/dashboard")
      }
      req.flash("success", "Successfully updated user: " + req.body.username);
      res.redirect("/dashboard");
    });
  }
});


//delete USER
app.delete("/dashboard/:id", isLoggedIn, function(req, res) {
  User.findByIdAndRemove(req.params.id, function(err) {
    if (err) {
      req.flash("error", "Could not remove user");
      res.redirect("/dashboard");
    } else {
      req.flash("success", "Removed user");
      res.redirect("/dashboard");
    }
  });
});


app.get("/profile/:id", function(req, res){
  res.render("profile", {
    currentUser: req.user,
  });
});

//show login form
app.get("/login", function(req, res) {
  res.render("login");
});

//handling login logic
app.post("/login", passport.authenticate("local", {
  successRedirect: "/home",
  failureRedirect: "/login",
  failureFlash: true
}), function() {});

//logout ROUTE
app.get("/logout", function(req, res) {
  req.logout();
  req.flash("success", "Successfully logged out");
  res.redirect("/login");
});



//isloggedin
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "Please log in first")
  res.redirect("/login");
}


//HEROKU CONFIG

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port , function(){
  console.log("IMS is up");
});