// metaradar.io | Activate Lambda function
// This file is part of the metardar.io project.
// Author: Ralph Kuepper
// Contact: info@metaradar.io
// License: MIT

const https = require('https');
const mysql = require('mysql2/promise');

exports.handler = async function (event, context) {
    let request = event;
    console.log("request: ", request.body);
    let code = request.queryStringParameters.code;

    var con = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DB
    });

    var sql = "SELECT * FROM addresses WHERE emailCode = ? AND confirmed = 0";

    let res = await con.execute(sql, [code]);

    if (res[0].length > 0) {

        let network = "ETH_MAINNET";
        if (res[0][0].network == "polygon") {
            network = "MATIC_MAINNET";
        }
        else if (res[0][0].network == "optimism") {
            network = "OPT_MAINNET";
        }
        else if (res[0][0].network == "arbitrum") {
            network = "ARB_MAINNET";
        }

        const options = {
            protocol: 'https:',
            hostname: 'dashboard.alchemy.com',
            port: 443,
            method: 'POST',
            path: '/api/create-webhook',
            headers: {
                'Content-Type': 'application/json',
                'X-Alchemy-Token': process.env.ALCHEMY_TOKEN
            }
        };
        const postBody = {
            "network": network,
            "webhook_type": "ADDRESS_ACTIVITY",
            "addresses": [
                res[0][0].address
            ],
            "webhook_url": "https://api.metaradar.io/v1/activity?address=" + res[0][0].address
        }
        let p = new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    console.log(body)
                    if (res.statusCode / 2 === 100) {
                        console.log('success')
                        resolve('Success');
                    }
                    else {
                        console.log('failed')
                        resolve('Failure');
                    }
                });
                res.on('error', () => {
                    console.log('error');
                    reject(Error('HTTP call failed'));
                });
            });
            req.write(JSON.stringify(postBody));
            req.end();

        });
        let r = await p;
        console.log("r: ", r);

        var sql = "UPDATE addresses SET confirmed = 1, emailCode = NULL, activatedAt = NOW() WHERE id = ?";
        await con.execute(sql, [res[0][0].id]);

        return {
            "success": true
        }
    }
    else {
        return {
            "success": false
        }
    }
}


