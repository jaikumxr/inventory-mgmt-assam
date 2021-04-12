const express = require('express')
const router = express.Router()
const isLoggedIn = require("../middlewares/isLoggedIn")
const json2xls = require('json2xls')
const pdf = require('pdf').pdf
const fs = require("fs")



router.post("/search/export/excel", isLoggedIn, (req, res) => {
    try {
        xls = []
        const sresult = JSON.parse(req.body.items)
        sresult.forEach((item) => {
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
    catch (err) {
        console.log(err);
    }
})

router.post("/search/export/pdf", isLoggedIn, (req, res) => {
    try {
        sresult = JSON.parse(req.body.items)
        doc = new pdf();
        doc.setFontSize(12);
        sresult.forEach(function (item) {
            x = 20;
            doc.text(20, x, "Item ID: " + item.itemObj.itemid);
            x += 10;
            doc.text(20, x, "Item Name: " + item.itemObj.iname);
            x += 10;
            doc.text(20, x, "Item Count: " + item.itemObj.icount);
            x += 10;
            doc.text(20, x, "Item Location: " + item.itemObj.location);
            x += 10;
            doc.text(20, x, "Item Type: " + item.itemObj.itype);
            x += 10
            doc.text(20, x, "Published on: " + (new Date(item.itemObj.publishedDate).toDateString()))
            x += 10
            doc.text(20, x, "Last modified on: " + (new Date(item.itemObj.lastModifiedDate).toDateString()))
            doc.addPage();
        })
        fs.writeFileSync("result.pdf", doc.output(), () => { })
        return res.download("result.pdf")
    }
    catch (err) {
        console.log(err);
    }
})

module.exports = router