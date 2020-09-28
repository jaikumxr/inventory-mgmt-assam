"use strict";

var bodyParser = require("body-parser"),
    methodOverride = require("method-override"),
    express = require("express"),
    app = express(),
    mongoose = require("mongoose"),
    passport = require("passport"),
    LocalStrategy = require("passport-local"),
    User = require("./models/user"),
    Vul = require("./models/vul"),
    Version = require("./models/version"),
    Alert = require("./models/alert"),
    needle = require("needle"),
    fs = require("fs"),
    flash = require("connect-flash"),
    json2xls = require('json2xls'),
    pdf = require('pdf').pdf;

var nodemailer = require("nodemailer");

var transporter = nodemailer.createTransport({
  service: "gmail",
  port: 587,
  secure: false,
  auth: {
    user: "vmfnciipc@gmail.com",
    pass: "vaphof-vuGwe9-hurgup"
  }
});
var m1,
    m2,
    currentVer,
    autoUpdate = false,
    xls = [],
    pdf,
    interv,
    timer = 1000 * 60 * 60 * 12,
    //edit this time in milliseconds for custom time interval between each autoupdate
sresult,
    newres,
    counter,
    alcount,
    // ALERT COUNT
subUsers = [],
    prod,
    vend,
    lastUpdate = new Date(),
    vullist = "";
var s1, s2, s3, s4, s5, s6, s7, s8; //CVSS SCORE VARIABLES FOR XLS FILE

var d1, d2; //DATE VARIABLE FOR DATA UPDATE
// mongoose.connect("mongodb://admin:hanuman023@ds145562.mlab.com:45562/heroku_mgpc0zjl", {

mongoose.connect("mongodb://localhost:27017/vmf", {
  useNewUrlParser: true,
  'useUnifiedTopology': true
});
mongoose.set('useFindAndModify', false);
var connection = mongoose.connection; // APP CONFIG

app.set("view engine", "ejs");
app.use(express["static"]("public"));
app.use(bodyParser.json({
  limit: '50mb'
}));
app.use(bodyParser.urlencoded({
  limit: '50mb',
  extended: true
}));
app.use(methodOverride("_method"));
app.use(flash()); // RESTFUL ROUTES

app.use(require("express-session")({
  secret: "masteroogway",
  resave: false,
  saveUninitialized: false
}));

function changeUpd() {
  Version.findOne({}, function (err, response) {
    if (response) {
      lastUpdate = response.version;
      lastUpdate = new Date(lastUpdate);
    }
  });
}

changeUpd();
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
app.use(function (req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});
app.get("/", function (req, res) {
  res.redirect("/home");
});
app.post("/import", isLoggedIn, function (req, res) {
  Version.where({}).findOne(function (err, result) {
    if (err) {
      console.log(err);
    }

    if (result) {
      currentVer = JSON.stringify(result.version).slice(1, 20) + ":000%20UTC-05:00";
      console.log(currentVer);
      console.log("Records modified after " + currentVer + " will be added to the DB.");
    }

    m2 = fs.readFileSync("./offline.meta", {
      encoding: "utf8"
    });
  });
  needle.get("https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-modified.meta", function (error, response, body) {
    if (!error && response.statusCode == 200) {
      m1 = body;
      console.log("NVD Meta: " + m1);
      console.log("Current stored Meta: " + m2);

      if (m2 != m1) {
        //create new offline meta
        fs.writeFile("offline.meta", m1, function (err) {
          if (err) {
            console.log(err);
          } else {
            console.log("Meta updated!");
          }
        }); //clear prev alerts

        Alert.updateMany({}, {
          vuls: [],
          count: 0
        }, function (err, response) {
          if (err) {
            console.log(err);
          }
        });
        console.log("Cleared alerts"); // comment out the following snippet when populating the Database initially

        needle.get("https://services.nvd.nist.gov/rest/json/cves/1.0?modStartDate=" + currentVer + "&resultsPerPage=2000", function (err, response, body) {
          // needle.get("https://services.nvd.nist.gov/rest/json/cves/1.0?modStartDate=2020-08-20T00:00:00:000%20UTC-05:00&resultsPerPage=2000", function(err, response, body) {
          Vul.insertMany(body.result.CVE_Items); //subscription alerts

          body.result.CVE_Items.forEach(function (vul) {
            Alert.find({}, function (err, alerts) {
              if (err) {
                console.log(err);
              } else {
                alerts.forEach(function (alert) {
                  counter = false;

                  if (String(vul.cve.description.description_data[0].value).search(alert.value) >= 0) {
                    counter = true;
                  }

                  try {
                    if (vul.configurations) {
                      if (vul.configurations.nodes[0]) {
                        vul.configurations.nodes[0].cpe_match.forEach(function (match) {
                          if (String(match.cpe23Uri).search(alert.value) > 0) {
                            counter = true;
                          }
                        });
                      }
                    }
                  } catch (error) {}

                  if (counter) {
                    Alert.findOneAndUpdate({
                      value: alert.value
                    }, {
                      $inc: {
                        count: 1
                      },
                      $push: {
                        vuls: vul.cve.CVE_data_meta.ID
                      }
                    }, function (err, response) {
                      if (err) {
                        console.log(err);
                      }
                    });
                  }
                });
              }
            });
          }); //this is the Mailer. It sends emails to all the users who have a new vulnerability from their subscriptions.

          function mailer() {
            setTimeout(function () {
              subUsers = [];
              Alert.find({}, function (err, alerts) {
                if (err) {
                  console.log(err);
                } else {
                  alerts.forEach(function (alert) {
                    alert.users.forEach(function (user) {
                      subUsers.push({
                        userid: user,
                        keyword: alert.value,
                        vuls: alert.vuls
                      });
                      console.log(user);
                    });
                  }); // sublist = [...new Set(subUsers)]; //redundant now
                  // sublist.forEach(function(item){  //redundant now

                  subUsers.forEach(function (item) {
                    console.log(item.userid);
                    vullist = "";
                    item.vuls.forEach(function (vul) {
                      vullist = vullist + " " + vul;
                    });
                    User.findById(item.userid, function (err, foundUser) {
                      if (foundUser) {
                        console.log("Sending mail to " + foundUser.email);
                        var mailOptions = {
                          from: "noreply@vmf",
                          to: foundUser.email,
                          subject: "New vulnerabilities from your subscription",
                          text: "\n                        Dear " + foundUser.username + ",\n                        This is an auto-generated email.\n                        There is a new vulnerability from one of your subscribed vendors/product:  " + item.keyword + "     \n                        Thanks\n                        VMF\n\n                        Time of updation: " + lastUpdate
                        };
                        transporter.sendMail(mailOptions, function (err, data) {
                          if (err) {
                            console.log(err);
                          } else {
                            console.log("Email Sent");
                          }
                        });
                      } else {
                        console.log("No user found " + item.userid);
                      }
                    });
                  });
                }
              });
            }, 45000); //a timer of 60 seconds has been added before mailing to ensure that the DB is updated correctly.
          }

          mailer();
          console.log("Database updated");
          console.log("The following items were added: ");
          console.log(body.result.CVE_Items);
        }); //use below code to populate inital Database; go from startIndex 0 till wherever no more data is added to the Database i.e,
        // startIndex=0, then 2000, then 4000 and so on till no more items are added.
        // needle.get("https://services.nvd.nist.gov/rest/json/cves/1.0?pubStartDate=2020-01-01T00:00:00:000%20UTC-05:00&startIndex=8000&resultsPerPage=2000", function(err, response, body){
        //   Vul.insertMany(body.result.CVE_Items);
        // });
        //this removes the meta version in DB and replace with current meta

        connection.dropCollection('versions', function (err) {
          if (err) {
            console.log(err);
          }
        });
        Version.create({
          "version": new Date()
        });
        req.flash("success", "Successfully updated database");
        res.redirect("/home");
      } else {
        req.flash("success", "Already up to date");
        res.redirect("/home");
      }
    }
  });
}); //index route

app.get("/home", isLoggedIn, function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  changeUpd();
  res.render("home", {
    currentUser: req.user,
    autoUpdate: autoUpdate,
    alcount: alcount,
    lastUpdate: lastUpdate
  });
}); //admin Dashboard

app.get("/dashboard", isLoggedIn, function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  User.find({}, function (err, users) {
    if (err) {
      console.log(err);
    } else {
      res.render("dashboard", {
        users: users,
        currentUser: req.user,
        autoUpdate: autoUpdate,
        alcount: alcount
      });
    }
  });
});
app.get("/dashboard/subscriptions", isLoggedIn, function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  Alert.find({}, function (err, response) {
    if (err) {
      console.log(err);
    } else {
      res.render("subedit", {
        currentUser: req.user,
        alcount: alcount,
        subs: response
      });
    }
  });
});
app.post("/dashboard/subscriptions", isLoggedIn, function (req, res) {
  Alert.create({
    value: req.body.subname,
    users: [],
    vuls: []
  }, function (err, response) {
    if (err) {
      console.log(err);
    }
  });
  res.redirect("/dashboard/subscriptions");
});
app["delete"]("/dashboard/subscriptions/:id", isLoggedIn, function (req, res) {
  Alert.findByIdAndRemove(req.params.id, function (err) {
    if (err) {
      req.flash("error", "Could not remove vendor/product");
      res.redirect("/dashboard/subscriptions");
    } else {
      req.flash("success", "Removed vendor/product");
      res.redirect("/dashboard/subscriptions");
    }
  });
}); //uncomment this to create initial admin in case an admin deletes all users
// var newUser = {"username":"admin","isAdmin":true,"email":"jai@example.com"};
// var password = "admin";
// User.register(newUser, password, function(err,user){
//   if(err){
//     console.log(err);
//   }
// });
//AUTH ROUTES
//show signup form

app.get("/dashboard/createuser", function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  res.render("register", {
    autoUpdate: autoUpdate,
    alcount: alcount
  });
}); //handle signup logic

app.post("/dashboard/createuser", function (req, res) {
  var _req$body = req.body,
      username = _req$body.username,
      password = _req$body.password,
      email = _req$body.email,
      firstName = _req$body.firstName,
      lastName = _req$body.lastName,
      confirmpassword = _req$body.confirmpassword;
  var errors = [];

  if (!username || !password || !email) {
    errors.push({
      msg: 'Please enter all required fields'
    });
  }

  var paswd = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{7,15}$/;

  if (!password.match(paswd)) {
    errors.push({
      msg: "Enter a password between 7 to 15 characters which contains at least one numeric digit and a special character."
    });
  }

  if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push({
      msg: "Please enter a valid email"
    });
  }

  if (password != confirmpassword) {
    errors.push({
      msg: "Both passwords are different. Kindly enter same password in the Confirm Password field."
    });
  }

  if (errors.length > 0) {
    req.flash("error", errors[0].msg);
    res.redirect("/dashboard/createuser");
  } else {
    var newUser = new User({
      username: req.body.username
    });

    if (req.body.role === "admin") {
      newUser.isAdmin = "true";
    }

    newUser.lastName = lastName;
    newUser.firstName = firstName;
    newUser.email = email;
    User.register(newUser, req.body.password, function (err) {
      if (err) {
        console.log(err);
        return res.redirect("/dashboard/createuser");
      }

      req.flash("success", "Successfully created user: " + req.body.username);
      res.redirect("/dashboard");
    });
  }
});
app.get("/dashboard/:id/edituser", isLoggedIn, function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  User.findById(req.params.id, function (err, foundUser) {
    if (err) {
      console.log(err);
    } else {
      res.render("edit", {
        user: foundUser,
        autoUpdate: autoUpdate,
        alcount: alcount
      });
    }
  });
});
app.put("/dashboard/:id", isLoggedIn, function (req, res) {
  var _req$body2 = req.body,
      username = _req$body2.username,
      password = _req$body2.password,
      email = _req$body2.email,
      firstName = _req$body2.firstName,
      lastName = _req$body2.lastName,
      confirmpassword = _req$body2.confirmpassword;
  var errors = [];

  if (!username || !password || !email) {
    errors.push({
      msg: 'Please enter all required fields'
    });
  }

  var paswd = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{7,15}$/;

  if (!password.match(paswd)) {
    errors.push({
      msg: "Enter a password between 7 to 15 characters which contains at least one numeric digit and a special character."
    });
  }

  if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push({
      msg: "Please enter a valid email"
    });
  }

  if (password != confirmpassword) {
    errors.push({
      msg: "Both passwords are different. Kindly enter same password in the Confirm Password field."
    });
  }

  if (errors.length > 0) {
    req.flash("error", errors[0].msg);
    res.redirect("/dashboard/" + req.params.id + "/edituser");
  } else {
    User.findByIdAndRemove(req.params.id, function (err) {
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
      email: req.body.email
    });

    if (req.body.role === "admin") {
      newUser.isAdmin = "true";
    }

    User.register(newUser, req.body.password, function (err) {
      if (err) {
        console.log(err);
        return res.redirect("/dashboard");
      }

      req.flash("success", "Successfully updated user: " + req.body.username);
      res.redirect("/dashboard");
    });
  }
}); //delete USER

app["delete"]("/dashboard/:id", isLoggedIn, function (req, res) {
  User.findByIdAndRemove(req.params.id, function (err) {
    if (err) {
      req.flash("error", "Could not remove user");
      res.redirect("/dashboard");
    } else {
      req.flash("success", "Removed user");
      res.redirect("/dashboard");
    }
  });
});
app.get("/home/searchresults/id", isLoggedIn, function (req, res) {
  res.redirect("/");
});
app.get("/home/searchresults/", isLoggedIn, function (req, res) {
  res.redirect("/");
});
app.get("/subscriptions", isLoggedIn, function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  Alert.find({}, function (err, response) {
    sresult = response;
  });
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    if (err) {
      console.log(err);
    } else {
      console.log(response);
      res.render("subscriptions", {
        currentUser: req.user,
        subs: response,
        alcount: alcount,
        allSubs: sresult
      });
    }
  });
});
app.post("/subscribe", isLoggedIn, function (req, res) {
  Alert.findOneAndUpdate({
    value: req.body.vendor
  }, {
    $push: {
      users: req.user._id
    }
  }, function (err, response) {
    if (err) {
      console.log(err);
      req.flash("error", "Could not subscribe. Vendor does not exist");
      res.redirect("/subscriptions");
    } else {
      console.log("Done");
      req.flash("success", "Successfully subscribed to " + req.body.vendor);
      res.redirect("/subscriptions");
    }
  }); // Alert.findOneAndUpdate({value: req.body.vendor}, {})
});
app.post("/unsubscribe", isLoggedIn, function (req, res) {
  Alert.findOneAndUpdate({
    value: req.body.vendor
  }, {
    $pull: {
      users: req.user._id
    }
  }, function (err, response) {
    if (err) {
      console.log(err);
      req.flash("error", "Could not unsubscribe");
      res.redirect("/subscriptions");
    } else {
      console.log("Done");
      req.flash("success", "Successfully unsubscribed from " + req.body.vendor);
      res.redirect("/subscriptions");
    }
  });
});
app.post("/home/searchresults/id", isLoggedIn, function (req, res) {
  console.log(req.body.cveid);
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  Vul.find({
    "cve.CVE_data_meta.ID": req.body.cveid
  }, function (err, result) {
    if (err) {
      console.log(err);
    } else {
      if (result.length > 0) {
        return res.render("sresult", {
          vuls: result,
          success: "If there are more than one matches, they show different modifications of the same Vulnerability",
          autoUpdate: autoUpdate,
          alcount: alcount
        });
      } else {
        req.flash("error", "No vulnerabilities found. Please check your search criteria.");
        return res.redirect("/home");
      }
    }
  });
});
app.post("/home/searchresults/", isLoggedIn, function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });

  if (req.body.severity != "ANY") {
    Vul.find({
      "publishedDate": {
        $gt: new Date(req.body.first).toJSON(),
        $lt: new Date(req.body.second).toJSON()
      },
      "impact.baseMetricV2.severity": req.body.severity
    }, function (err, result) {
      if (err) {
        console.log(err);
      } else {
        if (result.length > 0) {
          newres = [];
          result.forEach(function (vul) {
            counter = false;

            if (String(vul.cve.description.description_data[0].value).search(req.body.keywords) >= 0) {
              counter = true;
            }

            if (vul.configurations.nodes[0]) {
              vul.configurations.nodes[0].cpe_match.forEach(function (match) {
                if (String(match.cpe23Uri).search(req.body.keywords) > 0) {
                  counter = true;
                }
              });
            }

            if (counter) {
              newres.push(vul);
            }
          });

          if (newres.length > 0) {
            return res.render("sresult", {
              vuls: newres,
              success: "No. of vulnerabilities found: " + newres.length,
              autoUpdate: autoUpdate,
              alcount: alcount
            });
          } else {
            req.flash("error", "No vulnerabilities found. Please check your search criteria.");
            return res.redirect("/home");
          }
        } else {
          req.flash("error", "No vulnerabilities found. Please check your search criteria.");
          return res.redirect("/home");
        }
      }
    });
  } else {
    Vul.find({
      "publishedDate": {
        $gt: new Date(req.body.first).toJSON(),
        $lt: new Date(req.body.second).toJSON()
      }
    }, function (err, result) {
      if (err) {
        console.log(err);
      } else {
        if (result.length > 0) {
          newres = [];
          result.forEach(function (vul) {
            counter = false;

            if (String(vul.cve.description.description_data[0].value).search(req.body.keywords) >= 0) {
              counter = true;
            }

            if (vul.configurations.nodes[0]) {
              vul.configurations.nodes[0].cpe_match.forEach(function (match) {
                if (String(match.cpe23Uri).search(req.body.keywords) > 0) {
                  counter = true;
                }
              });
            }

            if (counter) {
              newres.push(vul);
            }
          });

          if (newres.length > 0) {
            return res.render("sresult", {
              vuls: newres,
              success: "No. of vulnerabilities found: " + newres.length,
              autoUpdate: autoUpdate,
              alcount: alcount
            });
          } else {
            req.flash("error", "No vulnerabilities found. Please check your search criteria.");
            return res.redirect("/home");
          }
        } else {
          req.flash("error", "No vulnerabilities found. Please check your search criteria.");
          return res.redirect("/home");
        }
      }
    });
  }
});
app.post("/home/searchresults/export/excel", function (req, res) {
  if (req.body.vuls) {
    xls = [];
    sresult = JSON.parse(req.body.vuls);
    sresult.forEach(function (vul) {
      d1 = new Date(vul.publishedDate);
      d2 = new Date(vul.lastModifiedDate);
      vend = "N/A";
      prod = "N/A";

      if (vul.configurations) {
        if (vul.configurations.nodes[0]) {
          if (vul.configurations.nodes[0].cpe_match[0]) {
            vend = vul.configurations.nodes[0].cpe_match[0].cpe23Uri.split(":")[3];
            prod = vul.configurations.nodes[0].cpe_match[0].cpe23Uri.split(":")[4];
          }
        }
      }

      s1 = "N/A";
      s2 = "N/A";
      s3 = "N/A";
      s4 = "N/A";
      s5 = "N/A";
      s6 = "N/A";
      s7 = "N/A";
      s8 = "N/A";

      if (vul.impact) {
        if (vul.impact.baseMetricV3) {
          if (vul.impact.baseMetricV3.exploitabilityScore) {
            s1 = vul.impact.baseMetricV3.exploitabilityScore;
          }

          if (vul.impact.baseMetricV3.impactScore) {
            s2 = vul.impact.baseMetricV3.impactScore;
          }

          if (vul.impact.baseMetricV3.cvssV3) {
            s3 = vul.impact.baseMetricV3.cvssV3.baseScore;
            s4 = vul.impact.baseMetricV3.cvssV3.baseSeverity;
          }
        }

        if (vul.impact.baseMetricV2) {
          if (vul.impact.baseMetricV2.exploitabilityScore) {
            s5 = vul.impact.baseMetricV2.exploitabilityScore;
          }

          if (vul.impact.baseMetricV2.impactScore) {
            s6 = vul.impact.baseMetricV2.impactScore;
          }

          if (vul.impact.baseMetricV2.cvssV2) {
            s7 = vul.impact.baseMetricV2.cvssV2.baseScore;
          }

          s8 = vul.impact.baseMetricV2.severity;
        }
      }

      xls.push({
        "CVE ID": vul.cve.CVE_data_meta.ID,
        "Published Date": d1.toDateString(),
        "Last Modified": d2.toDateString(),
        "Vendor": vend,
        "Product": prod,
        "v3 Exploitability Score": s1,
        "v3 Impact Score": s2,
        "v3 Base Score": s3,
        "v3 Base Severity": s4,
        "v2 Exploitability Score": s5,
        "v2 Impact Score": s6,
        "v2 Base Score": s7,
        "v2 Severity": s8
      });
    });
    xls = json2xls(xls);
    fs.writeFileSync('result.xlsx', xls, 'binary'); // req.flash("success","Successfully exported.")

    return res.download('./result.xlsx');
  } else {
    console.log("No data");
    req.flash("error", "Could not export empty search result.");
    return res.redirect("/home");
  }
});
app.post("/home/searchresults/export/pdf", function (req, res) {
  if (req.body.vuls) {
    sresult = JSON.parse(req.body.vuls);
    doc = new pdf();
    doc.setFontSize(12);
    sresult.forEach(function (vul) {
      d1 = new Date(vul.publishedDate);
      d2 = new Date(vul.lastModifiedDate);
      doc.text(20, 20, "CVE ID: " + vul.cve.CVE_data_meta.ID);
      doc.text(20, 40, "Published date: " + d1.toDateString());
      doc.text(20, 50, "Last modified on: " + d2.toDateString()); // doc.text(20, 60, "Description: "+(vul.cve.description.description_data[0].value));

      if (vul.configurations) {
        if (vul.configurations.nodes[0]) {
          if (vul.configurations.nodes[0].cpe_match[0]) {
            doc.text(20, 70, "Vendor:" + vul.configurations.nodes[0].cpe_match[0].cpe23Uri.split(":")[3]);
            doc.text(20, 80, "Product:" + vul.configurations.nodes[0].cpe_match[0].cpe23Uri.split(":")[4]);
          }
        }
      }

      if (vul.impact) {
        if (vul.impact.baseMetricV3) {
          doc.text(20, 100, "CVSS V3");

          if (vul.impact.baseMetricV3.exploitabilityScore) {
            doc.text(20, 110, "Exploitability Score: " + vul.impact.baseMetricV3.exploitabilityScore);
          }

          if (vul.impact.baseMetricV3.impactScore) {
            doc.text(20, 120, "Impact Score: " + vul.impact.baseMetricV3.impactScore);
          }

          if (vul.impact.baseMetricV3.cvssV3) {
            doc.text(20, 130, "Base Score: " + vul.impact.baseMetricV3.cvssV3.baseScore);
            doc.text(20, 140, "Base severity: " + vul.impact.baseMetricV3.cvssV3.baseSeverity);
          }
        }

        if (vul.impact.baseMetricV2) {
          doc.text(20, 160, "CVSS V2");

          if (vul.impact.baseMetricV2.exploitabilityScore) {
            doc.text(20, 170, "Exploitability Score: " + vul.impact.baseMetricV2.exploitabilityScore);
          }

          if (vul.impact.baseMetricV2.impactScore) {
            doc.text(20, 180, "Impact Score: " + vul.impact.baseMetricV2.impactScore);
          }

          if (vul.impact.baseMetricV2.cvssV2) {
            doc.text(20, 190, "Base Score: " + vul.impact.baseMetricV2.cvssV2.baseScore);
          }

          doc.text(20, 200, "Base severity: " + vul.impact.baseMetricV2.severity);
        }
      }

      doc.addPage();
    });
    fs.writeFileSync("result.pdf", doc.output(), function () {});
    return res.download("result.pdf");
  } else {
    console.log("No data");
    req.flash("error", "Could not export empty search result.");
    return res.redirect("/home");
  }
});
app.post("/dashboard/toggleAU", function (req, res) {
  autoUpdate = !autoUpdate;

  if (autoUpdate) {
    autoUpdateData();
    req.flash("success", "Auto update is enabled. The database will be updated every 12 hours.");
    res.redirect("/dashboard");
  } else {
    stopAutoUpdateData();
    req.flash("success", "Auto update is disabled");
    res.redirect("/dashboard");
  }
});
app.get("/profile/:id", function (req, res) {
  Alert.find({
    users: req.user._id
  }, function (err, response) {
    alcount = response.length;
  });
  res.render("profile", {
    currentUser: req.user,
    autoUpdate: autoUpdate,
    alcount: alcount
  });
}); //show login form

app.get("/login", function (req, res) {
  res.render("login");
}); //handling login logic

app.post("/login", passport.authenticate("local", {
  successRedirect: "/home",
  failureRedirect: "/login",
  failureFlash: true
}), function () {}); //logout ROUTE

app.get("/logout", function (req, res) {
  req.logout();
  req.flash("success", "Successfully logged out");
  res.redirect("/login");
}); //isloggedin

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  req.flash("error", "Please log in first");
  res.redirect("/login");
}

function autoUpdateData() {
  interv = setInterval(function () {
    //this is a modified code snippet of the import POST route
    Version.where({}).findOne(function (err, result) {
      if (err) {
        console.log(err);
      }

      if (result) {
        currentVer = JSON.stringify(result.version).slice(1, 20) + ":000%20UTC-05:00";
        console.log(currentVer);
        console.log("Records modified after " + currentVer + " will be added to the DB.");
      }

      m2 = fs.readFileSync("./offline.meta", {
        encoding: "utf8"
      });
    });
    needle.get("https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-modified.meta", function (error, response, body) {
      if (!error && response.statusCode == 200) {
        m1 = body;
        console.log("NVD Meta: " + m1);
        console.log("Current stored Meta: " + m2);

        if (m2 != m1) {
          fs.writeFile("offline.meta", m1, function (err) {
            if (err) {
              console.log(err);
            } else {
              console.log("Meta updated!");
            }
          });
          needle.get("https://services.nvd.nist.gov/rest/json/cves/1.0?modStartDate=" + currentVer + "&resultsPerPage=2000", function (err, response, body) {
            Vul.insertMany(body.result.CVE_Items);
            console.log("Database updated");
            console.log("The following items were added: ");
            console.log(body.result.CVE_Items);
          });
          connection.dropCollection('versions', function (err) {
            if (err) {
              console.log(err);
            }
          });
          Version.create({
            "version": new Date()
          });
          console.log("Updated");
        } else {
          console.log("Already up to date");
        }
      }
    });
  }, timer);
  console.log("AUTO UPDATE ENABLED");
}

function stopAutoUpdateData() {
  clearInterval(interv);
  console.log("AUTO UPDATE DISABLED");
} // replace ip with your system's ip
// app.listen(3000, '192.168.0.103', function() {
//   console.log("VMF is up");
// });
//for testing on localhost, use this and comment the above app.listen()


app.listen(3000, function () {
  console.log("VMF is up");
}); //HEROKU CONFIG
// let port = process.env.PORT;
// if (port == null || port == "") {
//   port = 3000;
// }
// app.listen(port);