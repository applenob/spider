/**
 * Created by cer on 2016/2/29.
 */
var http = require('http');
var fs = require('fs');
var cheerio = require('cheerio');
var url = require('url');
var path = require('path');
var async = require('async');

var imgs=[];//保存每条新闻的图片的路径
var url_base="http://www.ss.pku.edu.cn/index.php/newscenter/news";
var url_gets=[];

var start = "[";
saveData('data/data.json', start);

//访问所有页面
for(var i=0; i<=24; i++) {
    if (i != 0) {
        url_gets[i] = url_base + "?start=" + i * 20;
    }
    else url_gets[i] = url_base;
}

var concurrencyCount = 0;
var fetchUrl = function(url, callback) {
    concurrencyCount++;
    searchEveryPage(url);
    console.log('外层：现在的并发数是', concurrencyCount, '，正在抓取的是', url);
    setTimeout(function () {
        concurrencyCount--;
        callback(null, url + ' 外层：timeout');
    }, 5000);
};

//采用async进行并发控制
//这里是控制对不同新闻列表页的控制
async.mapLimit(url_gets, 2,
    function (url_get, callback) {
        fetchUrl(url_get, callback);
    },
    function (err, result) {
        console.log("final:");
        console.log(result);
    }
);

/**
 * 爬取每一页新闻列表的数据
 * @param url_get
 */
function searchEveryPage(url_get){
    console.log("url_get");
    //console.log(url_gets);
    //创建http get 请求
    http.get(url_get, function (res) {
        var html='';//保存抓取到的HTML源码
        var news=[];//保存解析HTML后的数据
        var links=[];//保存每条新闻的链接
        var links_news=[];
        var from;
        res.setEncoding('utf-8');

        //抓取页面内容
        res.on('data',function(chunk){
            html += chunk;
        });

        //网页内容抓取完毕
        res.on('end',function(){
            //console.log(html);
            var $ = cheerio.load(html);
            //如果拿不准选择器，可用console.log输出，看渠道的地址是否正确
            $('#info-list-ul li').each(function(index,item){
                var link_det = 'http://www.ss.pku.edu.cn'+$('a',this).attr('href');
                var news_item={
                    title:$('.info-title',this).text(), //获取新闻标题
                    time:$('.time',this).text(),//获取新闻时间
                    link:link_det,//获取新闻详情链接
                };
                //把所有新闻放在一个数组里面
                news.push(news_item);
                links.push(link_det);
                //将新闻和链接绑定
                var links_news_item={
                    news_tog:news_item,
                    link_tog:link_det
                }
                links_news.push(links_news_item)
            });
            //console.log(news);
            //console.log(links);

            var concurrencyCount = 0;
            var fetchLink = function(links_news_item, callback) {
                concurrencyCount++;
                search4News(links_news_item.link_tog, links_news_item.news_tog,from);
                console.log('内层：现在的并发数是', concurrencyCount, '，正在抓取的是', url);
                setTimeout(function () {
                    concurrencyCount--;
                    callback(null, url + '内层： html content');
                }, 2000);
            };
            //采用async进行并发控制
            async.mapLimit(links_news, 3,
                function (links_news_item, callback) {
                    fetchLink(links_news_item, callback);
                },
                function (err, result) {
                    console.log("final:");
                    console.log(result);
                }
            );

            //for(var i=0; i<links.length; i++) {
            //    search4News(links[i], news[i],from);
            //    //console.log(from);
            //    //console.log(news[i]);
            //}
            //console.log("after saved...");
            //console.log(news);
        });

    }).on('error',function(err){
        console.log(err);
    });
}
/**
*爬取每个新闻链接中的内容
 * @param {string} link 链接地址
 * @param {array} news 存取新闻信息的数组
 * @param {string} from 保存新闻来源的变量
 */
function search4News(link,news,from){
    //console.log(link);
    http.get(encodeURI(link), function (res) {
        //console.log(news);
        var html='';//保存抓取到的HTML源码
        res.setEncoding('utf-8');
        //抓取页面内容
        res.on('data',function(chunk){
            html += chunk;
        });
        //网页内容抓取完毕
        res.on('end',function(){
            var $ = cheerio.load(html);
            //爬取新闻来源
            from = $('.article-info a[title="供稿"]').text();
            from = from.trim();
            //console.log(from);
            news["from"]=from;
            //console.log(news);
            appendData('data/data.json',news);
            //爬取正文中的图片并保存
            $('.mainbody img').each(function(index,item) {
                var img_item = {
                    path: $(this).attr("src"),
                    title: $(this).parent().next().children().text()
                }
                imgs.push(img_item);
                //console.log(img_item);
                if(img_item.path!=null){
                    var url_sim = path.basename(img_item.path);
                    downloadImgs(img_item.path,url_sim);
                }
            });
            //爬取正文内容并保存
            $('.article-content').find('p[style!="text-align: center;"][align!="center"]').each(function(index,item){
                var content = $(this).text();
                //console.log(news.title);
                saveContent("data/contents/"+news.title,content+"\n");
            });
        });
    }).on('error',function(err){
        console.log(err);
        console.log(link);
    });
}
/**
 * 下载图片
 * @param url_whole 完整的图片url
 * @param url_sim   url中最后一部分
 */
function downloadImgs(url_whole,url_sim){
    //console.log(url_whole);
    //console.log(url_sim);
    http.get(encodeURI("http://www.ss.pku.edu.cn"+url_whole), function(res){
            var imgData = "";
            res.setEncoding("binary"); //一定要设置response的编码为binary否则会下载下来的图片打不开
            res.on("data", function(chunk){
                imgData+=chunk;
            });
            res.on("end", function(){
                fs.exists("data/imgs/"+url_sim, function(exists) {
                    if (exists) {
                        // 文件已经存在不下载
                        //console.log(filepath + ' is exists');
                    } else {
                        fs.writeFile("data/imgs/" + url_sim, imgData, "binary", function (err) {
                            if (err) {
                                console.log("download fail");
                            }
                            //console.log("download success");
                        });
                        //console.log(url_sim+" saved");
                    }
                });
            });
        });
}

/**
 * 保存数据到本地
 *
 * @param {string} path 保存数据的文件
 * @param {array} news 新闻信息数组
 */
function saveData(path,news){
    fs.writeFile(path,JSON.stringify(news,null,4),function(err){
        if(err){
            return console.log(err);
        }
        //console.log('Data saved');
    });
}

/**
 * 保存数据到本地
 *
 * @param {string} path 保存数据的文件
 */
function readData(path){
    fs.readFile(path,{encoding:'utf-8'}, function (err,byteRead) {
        if(err){
            console.log(err);
        }
        else{
            var data = JSON.parse(byteRead);
            console.log(data);
            console.log("readData success")
        }
    });
}

function appendData(path,news){
    fs.appendFile(path,JSON.stringify(news,null,4)+",",function(err){
        if(err){
            return console.log(err);
        }
        //console.log('Data saved');
    });
}
/**
 * 保存正文到本地
 */
function saveContent(path,content){
    fs.appendFile(path,content,function(err){
        if(err){
            return console.log(err);
        }
        //console.log('Content saved');
    });
}

function sleep(milliSeconds) {
    var startTime = new Date().getTime();
    while (new Date().getTime() < startTime + milliSeconds);
};