import asyncio, os
from aiogram import Bot, Dispatcher
from aiogram.filters import CommandStart
from aiogram.types import Message, WebAppInfo, InlineKeyboardMarkup, InlineKeyboardButton, MenuButtonWebApp
from dotenv import load_dotenv
load_dotenv()
async def main():
    token=os.getenv('BOT_TOKEN'); url=os.getenv('WEBAPP_URL')
    if not token or not url: raise SystemExit('Заполни BOT_TOKEN и WEBAPP_URL в .env')
    bot=Bot(token); dp=Dispatcher()
    @dp.message(CommandStart())
    async def start(m:Message):
        kb=InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(text='Открыть DOWNGRADE',web_app=WebAppInfo(url=url))]])
        await m.answer('Добро пожаловать в DOWNGRADE!',reply_markup=kb)
    await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text='DOWNGRADE',web_app=WebAppInfo(url=url)))
    await dp.start_polling(bot)
if __name__=='__main__': asyncio.run(main())
