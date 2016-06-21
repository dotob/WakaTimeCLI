import * as fs from 'fs';
import * as moment from 'moment';
import * as request from 'request';
import * as chalk from 'chalk';
import * as cmd from 'commander';
import * as _ from 'lodash';

export class WakaTimeCLI {
  apiString = '&api_key=';
  homedir = process.env.HOME;
  wakafile = this.homedir + '/.wakafile';
  apiUrl = "https://wakatime.com/api/v1";

  // Reads API Key from app directory
  readApiKey() {
    var key;
    try {
      key = fs.readFileSync(this.wakafile, 'utf8');
    } catch (e) {
      this.fileError();
    }
    if (key === '') {
      this.fileError();
    }
    return key;
  }

  // Stores API Key in app directory'
  setApiKey(apiKey) {
    fs.writeFile(this.wakafile, apiKey, function (err) {
      if (err) throw err;
      console.log('API key saved.');
    });
  };

  // Throw file error
  fileError() {
    console.log(' ');
    console.log(chalk.red(' No API Key provided'));
    console.log(chalk.red(" Example: ") + chalk.magenta("wakatime -api 'your key here' "));
    console.log(chalk.red(' Note: ') + chalk.magenta("your api key is available @ https://wakatime.com/settings"));
    console.log(' ');
    process.exit(0);
  };


  // Date function used to format date on API request
  dateInfo() {
    let df = "YYYY-MM-DD";
    return {
      day: moment().format(df),
      yesterday: moment().subtract(1, 'days').format(df),
      week: moment().subtract(6, 'days').format(df),
      month: moment().subtract(29, 'days').format(df),
      year: moment().subtract(364, 'days').format(df)
    }
  };

  formatTime(seconds) {
    return moment.duration(seconds, "s").humanize();
  }

  // Prints provided obj to terminal with chalk.magenta or blue color
  printSection(obj, color) {
    let sorted = _(obj).map((v,k) => {return {name: k, time: v}}).orderBy((o) => {return o.time}, 'desc').forEach((o) =>{
      console.log(color(` ${o.name}: `) + this.formatTime(o.time));
    });
  };

  doRequest(action): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        var apiKey = this.readApiKey();
        let url = `${this.apiUrl}/${action}${this.apiString}${apiKey}`;
        request(url, function (error, response, body) {

          if (!error && response.statusCode == 200) {
            var body = JSON.parse(body);
            resolve(body);
          } else {
            console.error(`request error for ${url}, status:${response.statusCode}, msg:${response.statusMessage}`, error);
            reject(error);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  // Prints user data to the terminal
  async user(): Promise<void> {
    let body = await this.doRequest("users/current");
    console.log('');
    console.log(chalk.cyan('WakaTime Account Details:'));
    console.log(chalk.magenta('  Account Created: ') + body.data.created_at);
    console.log(chalk.magenta('  Email: ') + body.data.email);
    if (body.data.full_name > '') {
      console.log(chalk.magenta('  Full Name: ') + body.data.full_name);
    }
    console.log('');
  }

  // Parse data for Today or Yesterday option & prints to terminal
  async detailsDay(day: string, dayText: string): Promise<void> {
    let body = await this.doRequest(`users/current/summaries?start=${day}&end=${day}`);

    console.log(' '); // Empty Line for formatting
    console.log(' ' + chalk.cyan(dayText + ': ') + body.data[0].grand_total.text + ' (Total)'); // Prints provided total hours/minutes
    console.log(' '); // Empty Line for formatting

    body.data[0].languages.forEach((val) => {
      console.log(chalk.magenta(' ' + val.name + ': ') + val.text); // Prints calculated total hours/minutes
    })

    console.log(' '); // Empty Line for formatting

    body.data[0].projects.forEach((val) => {
      console.log(chalk.blue(' ' + val.name + ': ') + val.text); // Prints calculated total hours/minutes
    })

    console.log(' '); // Empty Line for formatting
  };


  // Parse data for last seven days of work and print to console
  async detailsRange(from: string, dayText: string, to: string): Promise<void> {
    let body = await this.doRequest(`users/current/summaries?start=${from}&end=${to}`);

    let minutes = _(body.data).map('grand_total').sumBy((o:{hours:number, minutes:number}) => {return o.hours*60 + o.minutes});

    // Week Data logged to terminal here
    console.log(' '); // Empty Line for formatting
    console.log(' ' + chalk.cyan(dayText + ': ') + moment.duration(minutes, 'm').humanize() +' (Total)'); // Prints calculated total hours/minutes
    console.log(' '); // Empty Line for formatting

    _(body.data)
    .flatMap('languages')
    .groupBy((p:any)=>{return p.name})
    .map((list, name) => { return {name:name, sum: _.sumBy(list, 'total_seconds')}})
    .orderBy('sum', 'desc')
    .forEach((o) =>{
      console.log(chalk.magenta(` ${o.name}: `) + this.formatTime(o.sum));
    });

    console.log(' '); // Empty Line for formatting
    
    _(body.data)
    .flatMap('projects')
    .groupBy((p:any)=>{return p.name})
    .map((list, name) => { return {name:name, sum: _.sumBy(list, 'total_seconds')}})
    .orderBy('sum', 'desc')
    .forEach((o) =>{
      console.log(chalk.blue(` ${o.name}: `) + this.formatTime(o.sum));
    });

    console.log(' '); // Empty Line for formatting
  }
}


cmd.version('0.0.1')

let gotCommand = false;
let w = new WakaTimeCLI();

cmd.command('today')
  .alias("t")
  .description('show todays data')
  .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsDay(day.day, "Today");
  });

cmd.command('week')
  .alias("w")
  .description('show weeks data')
  .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.week, "Week", day.day);
  });

cmd.command('month')
  .alias("m")
  .description('show months data')
  .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.month, "Month", day.day);
  });

cmd.command('year')
  .alias("m")
  .description('show years data')
  .action(() => {
    gotCommand = true;
    var day = w.dateInfo();
    w.detailsRange(day.year, "Year", day.day);
  });

cmd.command('api <key>')
  .description('store the given api key')
  .action((key) => {
    gotCommand = true;
    w.setApiKey(key);
  });

// handle today as default
if (!gotCommand) {
  process.argv.push('t')
}

cmd.parse(process.argv);