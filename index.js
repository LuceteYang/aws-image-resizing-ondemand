'use strict';

const http = require('http');
const https = require('https');
const querystring = require('querystring');

const AWS = require('aws-sdk');
const S3 = new AWS.S3({
  signatureVersion: 'v4',
});
const Sharp = require('sharp');

// set the S3 and API GW endpoints
const BUCKET = 'BUCKETNAME';

exports.handler = (event, context, callback) => {
  let response = event.Records[0].cf.response;

  console.log("Response status code :%s", response.status);

  //check if image is not present
  if (response.status == 200) {

    let request = event.Records[0].cf.request;
    let params = querystring.parse(request.querystring);

    // if there is no dimension attribute, just pass the response
    if (!params['x-oss-process']) {
      callback(null, response);
      return;
    }
    var paramArr = params['x-oss-process'].split('/');
    var paramObj = {format:'jpg'};
    paramArr.map(function(param){
      var obj = param.split(',');
      if(obj.length>1){
        if(obj[0]=='format'){
          paramObj[obj[0]] = obj[1]   
        }else if(obj[0]=='resize'){
            paramObj['height'] = 99999;
            paramObj['width'] = 99999;
            obj.map(function(subParam){
              if(subParam.includes("w_")){
                  paramObj['width'] = parseInt(subParam.replace("w_",""), 10);
              }else if(subParam.includes("h_")){
                  paramObj['height'] = parseInt(subParam.replace("h_",""), 10);
              }
            })
        }
      }
    });
	console.log(JSON.stringify(paramObj));
    // read the required path. Ex: uri /images/100x100/webp/image.jpg
    let path = request.uri;

    // read the S3 key from the path variable.
    // Ex: path variable /images/100x100/webp/image.jpg
    let key = path.substring(1);
    // get the source image file
    S3.getObject({ Bucket: BUCKET, Key: key }).promise()
      // perform the resize operation
      .then(data => Sharp(data.Body)
        .resize(paramObj['width'],paramObj['height'])
	.max()
        .toFormat(paramObj['format'])
        .toBuffer()
      )
      .then(buffer => {
        // save the resized object to S3 bucket with appropriate object key.
        response.status = 200;
        response.body = buffer.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/'+paramObj['format'] }];
        callback(null, response);
      })
    .catch( err => {
      console.log('error ',err);
      callback(null,response);
    });
  } // end of if block checking response statusCode
  else {
    // allow the response to pass through
    callback(null, response);
  }
};
